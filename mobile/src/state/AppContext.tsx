import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { User as AuthUser } from '@supabase/supabase-js';
import { mockService } from '../services/mockService';
import { isValidEstimatedFare } from '../services/creditPolicy';
import { isSupabaseConfigured, supabase } from '../services/supabaseClient';
import { mutate, readCreditSummary } from '../services/capstoneApi';
import { coordinates } from '../services/routeReuse';
import { authErrorMessage, authSetupMessage, loadOrRepairProfile, validateLogin, validateSignup } from '../services/authService';
import { profileInput, saveMyProfile } from '../services/profileService';
import { ROOM_CAPACITY } from '../services/roomPolicy';
import type { AppData, CreditLedgerRecord, CreditReservationRecord, Profile, Room, RoomMemberRecord, RoomRecord, Settlement, SettlementItemRecord, SettlementRecord, User } from '../types';

type NewRoom = Pick<Room, 'departure' | 'destination' | 'departureAt' | 'estimatedFare' |
  'departureCoordinates' | 'destinationCoordinates'>;
type AppContextValue = {
  data: AppData;
  user: User | undefined;
  balance: number;
  heldCredit: number;
  creditLoading: boolean;
  settlementRecords: SettlementRecord[];
  settlementItems: SettlementItemRecord[];
  mode: 'supabase' | 'mock';
  isLoading: boolean;
  isAuthenticated: boolean;
  profile: Profile | null;
  profileError: string;
  retryProfile: () => void;
  updateProfile: (nickname: string, school: string) => Promise<void>;
  mockAuthEnabled: boolean;
  refreshRooms: () => Promise<void>;
  refreshCredits: () => Promise<void>;
  refreshSettlements: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  register: (nickname: string, email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  createRoom: (input: NewRoom) => Promise<string>;
  joinRoom: (id: string) => Promise<void>;
  confirmRoom: (id: string) => Promise<void>;
  prepareRoom: (id: string) => Promise<void>;
  expireReadyCheck: (id: string) => Promise<void>;
  cancelRoom: (id: string) => Promise<void>;
  boardRoom: (id: string) => Promise<void>;
  reportNoShow: (id: string) => Promise<void>;
  charge: (amount: number) => void;
  settleRoom: (id: string, fare: number, evidence?: string) => Promise<string>;
  confirmSettlement: (id: string, version: number) => Promise<void>;
  disputeSettlement: (id: string, version: number, reason: string) => Promise<void>;
  reviseFare: (id: string, fare: number, evidence: string) => Promise<void>;
  finalizeSettlement: (id: string, version: number) => Promise<void>;
};

const AppContext = createContext<AppContextValue | null>(null);
const emptyData = (): AppData => ({
  currentUserId: null, users: [], rooms: [], balances: {}, transactions: [], settlements: [],
});
const demoColor = '#8DBD99';
const mockAuthEnabled = process.env.EXPO_PUBLIC_ENABLE_MOCK_AUTH === 'true';

function legacyStatus(status: RoomRecord['status']): Room['status'] {
  if (status === 'OPEN') return 'recruiting';
  if (status === 'FIXED') return 'confirmed';
  if (status === 'SETTLED') return 'settled';
  return 'other';
}

function toLegacyRoom(record: RoomRecord, members: RoomMemberRecord[], reservations: CreditReservationRecord[]): Room {
  return {
    id: record.id, hostId: record.host_id,
    departure: record.departure_text, destination: record.destination_text,
    departureCoordinates: coordinates(record.departure_lat, record.departure_lng),
    destinationCoordinates: coordinates(record.destination_lat, record.destination_lng),
    departureAt: record.departure_at, maxMembers: record.max_members,
    estimatedFare: record.estimated_fare, status: legacyStatus(record.status),
    dbStatus: record.status,
    readyDeadlineAt: record.ready_deadline_at,
    memberCountKnown: members.some((member) => member.room_id === record.id),
    members: members.filter((member) => member.room_id === record.id && member.member_status === 'JOINED')
      .map((member) => ({ userId: member.user_id, boarded: member.boarded_status === 'BOARDED',
        boardedStatus: member.boarded_status, ready: member.ready_status === 'READY',
        deposit: reservations.find((reservation) => reservation.room_id === record.id
          && reservation.user_id === member.user_id && reservation.status === 'HELD')?.amount ?? 0 })),
  };
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<AppData>(() => isSupabaseConfigured || !mockAuthEnabled ? emptyData() : mockService.initialData());
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileError, setProfileError] = useState('');
  const [profileAttempt, setProfileAttempt] = useState(0);
  const [heldCredit, setHeldCredit] = useState(0);
  const [creditLoading, setCreditLoading] = useState(isSupabaseConfigured);
  const [settlementRecords, setSettlementRecords] = useState<SettlementRecord[]>([]);
  const [settlementItems, setSettlementItems] = useState<SettlementItemRecord[]>([]);
  const reservationsRef = useRef<CreditReservationRecord[]>([]);
  const authUserIdRef = useRef<string | null>(null);
  const roomRefreshSeq = useRef(0);
  const [isLoading, setIsLoading] = useState(isSupabaseConfigured);
  const user = data.users.find((item) => item.id === data.currentUserId);
  const balance = user ? data.balances[user.id] ?? 0 : 0;

  const refreshRooms = useCallback(async () => {
    if (!supabase || !authUserIdRef.current) return;
    const requestingUserId = authUserIdRef.current;
    const requestSeq = ++roomRefreshSeq.current;
    const { data: roomRows, error: roomError } = await supabase
      .from('rooms').select('*').order('departure_at', { ascending: true });
    if (roomError) throw roomError;
    const records = (roomRows ?? []) as RoomRecord[];
    const roomIds = records.map((room) => room.id);
    let members: RoomMemberRecord[] = [];
    if (roomIds.length) {
      const { data: memberRows, error: memberError } = await supabase
        .from('room_members').select('*').in('room_id', roomIds);
      if (memberError) throw memberError;
      members = (memberRows ?? []) as RoomMemberRecord[];
    }
    if (authUserIdRef.current !== requestingUserId || requestSeq !== roomRefreshSeq.current) return;
    const ids = [...new Set(members.map((member) => member.user_id))];
    setData((previous) => {
      const me = previous.users.find((item) => item.id === requestingUserId);
      const anonymous = ids.filter((id) => id !== requestingUserId)
        .map((id, index) => ({ id, nickname: `동승자 ${index + 1}`, email: '', color: demoColor }));
      return {
        ...previous, rooms: records.map((room) => toLegacyRoom(room, members, reservationsRef.current)),
        users: [...(me ? [me] : []), ...anonymous],
      };
    });
  }, []);

  const refreshCredits = useCallback(async () => {
    if (!supabase || !authUserIdRef.current) return;
    const requestingUserId = authUserIdRef.current;
    setCreditLoading(true);
    try {
      const [summary, ledgerResult, reservationResult] = await Promise.all([
        readCreditSummary(),
        supabase.from('credit_ledger').select('id,user_id,room_id,settlement_id,entry_type,amount,created_at')
          .order('created_at', { ascending: false }).limit(100),
        supabase.from('room_credit_reservations').select('id,room_id,user_id,amount,status,created_at'),
      ]);
      if (ledgerResult.error) throw ledgerResult.error;
      if (reservationResult.error) throw reservationResult.error;
      if (authUserIdRef.current !== requestingUserId) return;
      const ledger = (ledgerResult.data ?? []) as CreditLedgerRecord[];
      const currentReservations = (reservationResult.data ?? []) as CreditReservationRecord[];
      reservationsRef.current = currentReservations;
      setHeldCredit(summary.held_credit);
      setData((previous) => ({ ...previous,
        balances: { ...previous.balances, [requestingUserId]: summary.available_credit },
        rooms: previous.rooms.map((room) => ({ ...room, members: room.members.map((member) => ({
          ...member, deposit: currentReservations.find((reservation) => reservation.room_id === room.id
            && reservation.user_id === member.userId && reservation.status === 'HELD')?.amount ?? 0,
        })) })),
        transactions: ledger.map((entry) => ({
          id: entry.id, userId: entry.user_id,
          type: entry.entry_type === 'ROOM_HOLD' ? 'deposit' : entry.entry_type === 'ROOM_RELEASE' ? 'refund'
            : entry.entry_type === 'SETTLEMENT_DEBIT' ? 'use' : 'charge',
          amount: entry.amount, title: entry.entry_type === 'TEST_GRANT' ? '개발용 테스트 크레딧 지급'
            : entry.entry_type === 'ROOM_HOLD' ? '방 예치' : entry.entry_type === 'ROOM_RELEASE' ? '예치 해제'
              : entry.entry_type === 'SETTLEMENT_DEBIT' ? '동승 분담금' : '개발용 조정',
          createdAt: entry.created_at,
        })),
      }));
    } finally { setCreditLoading(false); }
  }, []);

  const refreshSettlements = useCallback(async () => {
    if (!supabase || !authUserIdRef.current) return;
    const requestingUserId = authUserIdRef.current;
    const [settlementResult, itemResult] = await Promise.all([
      supabase.from('settlements').select('*').order('created_at', { ascending: false }),
      supabase.from('settlement_items').select('*'),
    ]);
    if (settlementResult.error) throw settlementResult.error;
    if (itemResult.error) throw itemResult.error;
    if (authUserIdRef.current !== requestingUserId) return;
    const records = (settlementResult.data ?? []) as SettlementRecord[];
    const items = (itemResult.data ?? []) as SettlementItemRecord[];
    setSettlementRecords(records);
    setSettlementItems(items);
    setData((previous) => ({ ...previous,
      settlements: records.filter((record) => record.status === 'COMPLETED').flatMap((record) => {
        const mine = items.find((item) => item.settlement_id === record.id && item.user_id === requestingUserId);
        if (!mine) return [];
        return [{ id: record.id, roomId: record.room_id, userId: requestingUserId,
          actualFare: record.actual_fare, riderCount: previous.rooms.find((room) => room.id === record.room_id)
            ?.members.filter((member) => member.boarded).length ?? 0,
          share: mine.share_amount, refund: mine.refund_amount,
          createdAt: record.completed_at ?? record.created_at }];
      }),
    }));
  }, []);

  useEffect(() => {
    if (!supabase) return;
    let active = true;
    let receivedEvent = false;
    const applyUser = (next: AuthUser | null) => {
      if (!active) return;
      if (authUserIdRef.current !== (next?.id ?? null)) {
        setProfile(null);
        setProfileError('');
        setHeldCredit(0);
        setCreditLoading(false);
        setSettlementRecords([]);
        setSettlementItems([]);
        reservationsRef.current = [];
        roomRefreshSeq.current++;
        setData({ ...emptyData(), currentUserId: next?.id ?? null });
      }
      authUserIdRef.current = next?.id ?? null;
      setAuthUser(next);
      setIsLoading(false);
    };
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      // Keep this callback synchronous; DB requests run in the profile effect.
      receivedEvent = true;
      applyUser(session?.user ?? null);
    });
    void supabase.auth.getSession().then(({ data: result }) => {
      if (!receivedEvent) applyUser(result.session?.user ?? null);
    }).catch(() => { if (!receivedEvent) applyUser(null); });
    return () => { active = false; listener.subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    if (!supabase || !authUser) return;
    const client = supabase;
    const current = authUser;
    if (!current) return;
    let active = true;
    const load = async () => {
      try {
        const loaded = await loadOrRepairProfile(client, current);
        if (!active || authUserIdRef.current !== current.id) return;
        const me: User = { id: loaded.id, nickname: loaded.nickname,
          email: current.email ?? loaded.email ?? '', color: demoColor };
        setProfile(loaded);
        setProfileError('');
        setData((previous) => ({ ...previous, users: [me, ...previous.users.filter((item) => item.id !== me.id)] }));
      } catch (cause) {
        if (active && authUserIdRef.current === current.id) setProfileError(authErrorMessage(cause));
      }
    };
    void load();
    void refreshRooms().then(refreshSettlements)
      .catch((error) => console.warn('Room or settlement load failed:', error));
    void refreshCredits().catch((error) => console.warn('Credit load failed:', error));
    return () => { active = false; };
  }, [authUser, profileAttempt, refreshRooms, refreshCredits, refreshSettlements]);

  const login = async (email: string, password: string) => {
    validateLogin(email, password);
    if (supabase) {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) throw error;
      return;
    }
    if (!mockAuthEnabled) throw new Error(authSetupMessage);
    const nextUser = mockService.login(data.users, email, password);
    setData((previous) => ({ ...previous, currentUserId: nextUser.id }));
  };
  const register = async (nickname: string, email: string, password: string): Promise<boolean> => {
    validateSignup(nickname, email, password, password);
    if (supabase) {
      const { data: result, error } = await supabase.auth.signUp({
        email: email.trim(), password, options: { data: { nickname: nickname.trim() } },
      });
      if (error) throw error;
      if (result.user?.identities?.length === 0) throw new Error('이미 가입된 이메일일 수 있습니다. 로그인하거나 확인 메일을 확인해 주세요.');
      if (result.session?.user) {
        return true;
      }
      return false; // Email confirmation is enabled in the Supabase project.
    }
    if (!mockAuthEnabled) throw new Error(authSetupMessage);
    const nextUser = mockService.register(data.users, nickname, email, password);
    setData((previous) => ({ ...previous, users: [...previous.users, nextUser], balances: { ...previous.balances, [nextUser.id]: 15000 }, currentUserId: nextUser.id }));
    return true;
  };
  const logout = async () => {
    if (supabase) {
      const { error } = await supabase.auth.signOut({ scope: 'local' });
      if (error) throw error;
      authUserIdRef.current = null;
      setAuthUser(null);
      setProfile(null);
      setProfileError('');
      setHeldCredit(0);
      setCreditLoading(false);
      setSettlementRecords([]);
      setSettlementItems([]);
      reservationsRef.current = [];
      roomRefreshSeq.current++;
      setData(emptyData());
      return;
    }
    setData((previous) => ({ ...previous, currentUserId: null }));
  };

  const updateProfile = async (nickname: string, school: string) => {
    const patch = profileInput(nickname, school);
    const id = supabase ? authUserIdRef.current : user?.id;
    if (!id) throw new Error('로그인이 필요합니다.');
    if (supabase) {
      const saved = await saveMyProfile(supabase, id, nickname, school);
      if (authUserIdRef.current !== id) return;
      setProfile(saved);
      setData((previous) => ({ ...previous, users: previous.users.map((item) => item.id === id
        ? { ...item, nickname: saved.nickname } : item) }));
      return;
    }
    setData((previous) => ({ ...previous, users: previous.users.map((item) => item.id === id
      ? { ...item, nickname: patch.nickname } : item) }));
  };

  const createRoom = async (input: NewRoom): Promise<string> => {
    if (!(supabase ? authUserIdRef.current : user)) throw new Error('로그인이 필요합니다.');
    if (!input.departure.trim() || !input.destination.trim()) throw new Error('출발지와 목적지를 입력해 주세요.');
    if (input.departure.trim() === input.destination.trim()) throw new Error('출발지와 목적지가 같을 수 없습니다.');
    if (!isValidEstimatedFare(input.estimatedFare)) throw new Error('예상 택시 요금은 안전한 범위의 양의 정수여야 해요.');
    if (new Date(input.departureAt).getTime() <= Date.now()) throw new Error('미래의 출발 시간을 선택해 주세요.');
    if (supabase) {
      const { departureCoordinates, destinationCoordinates } = input;
      const hasCoordinates = Boolean(departureCoordinates || destinationCoordinates);
      const created = await mutate<{ room_id: string }>(hasCoordinates ? 'create_room_with_coordinates' : 'create_room', {
        p_departure_text: input.departure.trim(), p_destination_text: input.destination.trim(),
        p_departure_at: input.departureAt, p_max_members: ROOM_CAPACITY,
        p_estimated_fare: input.estimatedFare,
        ...(hasCoordinates ? {
          p_departure_lat: departureCoordinates?.latitude ?? null,
          p_departure_lng: departureCoordinates?.longitude ?? null,
          p_destination_lat: destinationCoordinates?.latitude ?? null,
          p_destination_lng: destinationCoordinates?.longitude ?? null,
        } : {}),
      });
      await refreshRooms().catch((cause) => console.warn('Room refresh after creation failed:', cause));
      return created.room_id;
    }
    if (!user) throw new Error('로그인이 필요합니다.');
    const deposit = mockService.depositFor({ ...input, maxMembers: ROOM_CAPACITY });
    if (balance < deposit) throw new Error('방을 만들 예치 포인트가 부족합니다. 지갑에서 충전해 주세요.');
    const id = `r${Date.now()}`;
    const room: Room = { ...input, id, maxMembers: ROOM_CAPACITY, departure: input.departure.trim(), destination: input.destination.trim(), hostId: user.id, status: 'recruiting', members: [{ userId: user.id, boarded: false, deposit }] };
    setData((previous) => ({
      ...previous,
      balances: { ...previous.balances, [user.id]: (previous.balances[user.id] ?? 0) - deposit },
      rooms: [room, ...previous.rooms],
      transactions: [{ id: `t${Date.now()}`, userId: user.id, type: 'deposit', amount: -deposit, title: `${room.departure} → ${room.destination} 예치`, createdAt: new Date().toISOString() }, ...previous.transactions],
    }));
    return id;
  };

  const joinRoom = async (id: string) => {
    const participantId = supabase ? authUserIdRef.current : user?.id;
    if (!participantId) throw new Error('로그인이 필요합니다.');
    const room = data.rooms.find((item) => item.id === id);
    if (!room) throw new Error('방을 찾을 수 없습니다.');
    if (room.status !== 'recruiting') throw new Error('모집이 끝난 방입니다.');
    if (room.members.some((member) => member.userId === participantId)) return;
    if (room.members.length >= room.maxMembers) throw new Error('모집 인원이 가득 찼습니다.');
    if (supabase) {
      await mutate('join_room', { p_room_id: id });
      await refreshRooms().catch((cause) => console.warn('Room refresh after joining failed:', cause));
      return;
    }
    if (!user) throw new Error('로그인이 필요합니다.');
    const deposit = mockService.depositFor(room);
    if (balance < deposit) throw new Error('포인트가 부족합니다. 지갑에서 충전해 주세요.');
    setData((previous) => ({
      ...previous,
      balances: { ...previous.balances, [user.id]: (previous.balances[user.id] ?? 0) - deposit },
      rooms: previous.rooms.map((item) => item.id === id ? { ...item, members: [...item.members, { userId: user.id, boarded: false, deposit }] } : item),
      transactions: [{ id: `t${Date.now()}`, userId: user.id, type: 'deposit', amount: -deposit, title: `${room.departure} → ${room.destination} 예치`, createdAt: new Date().toISOString() }, ...previous.transactions],
    }));
  };

  const confirmRoom = async (id: string) => {
    if (supabase) {
      await mutate('start_ready_check', { p_room_id: id });
      await refreshRooms();
      return;
    }
    const room = data.rooms.find((item) => item.id === id);
    if (!room || room.hostId !== user?.id) throw new Error('방장만 방을 확정할 수 있습니다.');
    if (room.members.length < 2) throw new Error('두 명 이상 참여해야 방을 확정할 수 있습니다.');
    setData((previous) => ({ ...previous, rooms: previous.rooms.map((item) => item.id === id ? { ...item, status: 'confirmed' } : item) }));
  };

  const prepareRoom = async (id: string) => {
    if (!supabase) throw new Error('준비 확인은 Supabase 모드에서만 가능합니다.');
    await mutate('prepare_member', { p_room_id: id });
    await Promise.all([refreshCredits(), refreshRooms()]);
  };

  const expireReadyCheck = async (id: string) => {
    if (!supabase) return;
    await mutate('expire_ready_check', { p_room_id: id });
    await Promise.all([refreshCredits(), refreshRooms()]);
  };

  const cancelRoom = async (id: string) => {
    if (!supabase) throw new Error('방 취소는 Supabase 모드에서만 가능합니다.');
    await mutate('cancel_room', { p_room_id: id });
    await Promise.all([refreshCredits(), refreshRooms()]);
  };

  const boardRoom = async (id: string) => {
    if (supabase) {
      await mutate('mark_boarding', { p_room_id: id });
      await refreshRooms();
      return;
    }
    const room = data.rooms.find((item) => item.id === id);
    if (!room || room.status !== 'confirmed') throw new Error('확정된 방에서 탑승을 확인할 수 있습니다.');
    if (!room.members.some((member) => member.userId === user?.id)) throw new Error('참여한 방만 탑승을 확인할 수 있습니다.');
    setData((previous) => ({ ...previous, rooms: previous.rooms.map((item) => item.id === id ? { ...item, members: item.members.map((member) => member.userId === user?.id ? { ...member, boarded: true } : member) } : item) }));
  };

  const reportNoShow = async (id: string) => {
    if (!supabase) throw new Error('미탑승 보고는 Supabase 모드에서만 가능합니다.');
    await mutate('report_no_show', { p_room_id: id });
    await refreshRooms();
  };

  const charge = (amount: number) => {
    if (supabase) throw new Error('Supabase 모드에서는 개발용 seed로만 TEST 크레딧을 지급합니다.');
    if (!user || amount <= 0) throw new Error('충전 금액을 선택해 주세요.');
    setData((previous) => ({
      ...previous,
      balances: { ...previous.balances, [user.id]: (previous.balances[user.id] ?? 0) + amount },
      transactions: [{ id: `t${Date.now()}`, userId: user.id, type: 'charge', amount, title: '포인트 충전', createdAt: new Date().toISOString() }, ...previous.transactions],
    }));
  };

  const settleRoom = async (id: string, fare: number, evidence = '개인정보를 가린 시연용 증빙') => {
    if (supabase) {
      if (!Number.isSafeInteger(fare) || fare <= 0) throw new Error('실제 요금을 양의 정수로 입력해 주세요.');
      const result = await mutate<{ settlement_id: string }>('submit_fare', {
        p_room_id: id, p_actual_fare: fare,
        p_evidence_type: 'SAMPLE', p_evidence_reference: evidence,
      });
      await refreshRooms();
      await refreshSettlements();
      return result.settlement_id;
    }
    if (!user) throw new Error('로그인이 필요합니다.');
    const room = data.rooms.find((item) => item.id === id);
    if (!room || room.status !== 'confirmed') throw new Error('정산할 수 없는 방입니다.');
    if (room.hostId !== user.id) throw new Error('방장만 정산할 수 있습니다.');
    if (!Number.isInteger(fare) || fare <= 0) throw new Error('올바른 택시 요금을 입력해 주세요.');
    const boarded = room.members.filter((member) => member.boarded);
    if (boarded.length === 0) throw new Error('탑승 완료한 동승자가 없습니다.');
    const settlements: Settlement[] = boarded.map((member) => mockService.settle(room, member.userId, fare));
    const mine = settlements.find((item) => item.userId === user.id);
    if (!mine) throw new Error('탑승 완료 후 정산할 수 있습니다.');
    const nextBalances = { ...data.balances };
    const nextTransactions: AppData['transactions'] = [];
    room.members.forEach((member) => {
      const result = settlements.find((item) => item.userId === member.userId);
      const refund = result?.refund ?? member.deposit;
      nextBalances[member.userId] = (nextBalances[member.userId] ?? 0) + refund;
      if (result) nextTransactions.push({ id: `t${result.id}-use`, userId: member.userId, type: 'use', amount: -result.share, title: `${room.departure} → ${room.destination} 정산`, createdAt: result.createdAt });
      nextTransactions.push({ id: `t${id}-${member.userId}-refund`, userId: member.userId, type: 'refund', amount: refund, title: result ? '예치 잔액 환불' : '미탑승 예치금 환불', createdAt: mine.createdAt });
    });
    setData((previous) => ({
      ...previous,
      balances: nextBalances,
      rooms: previous.rooms.map((item) => item.id === id ? { ...item, status: 'settled' } : item),
      settlements: [...settlements, ...previous.settlements],
      transactions: [...nextTransactions, ...previous.transactions],
    }));
    return mine.id;
  };

  const confirmSettlement = async (id: string, version: number) => {
    await mutate('confirm_settlement', { p_settlement_id: id, p_settlement_version: version });
    await refreshSettlements();
  };
  const disputeSettlement = async (id: string, version: number, reason: string) => {
    await mutate('dispute_settlement', { p_settlement_id: id, p_settlement_version: version, p_reason: reason });
    await Promise.all([refreshRooms(), refreshSettlements()]);
  };
  const reviseFare = async (id: string, fare: number, evidence: string) => {
    if (!Number.isSafeInteger(fare) || fare <= 0) throw new Error('요금을 양의 정수로 입력해 주세요.');
    await mutate('revise_fare', { p_settlement_id: id, p_actual_fare: fare,
      p_evidence_type: 'SAMPLE', p_evidence_reference: evidence });
    await Promise.all([refreshRooms(), refreshSettlements()]);
  };
  const finalizeSettlement = async (id: string, version: number) => {
    await mutate('finalize_settlement', { p_settlement_id: id, p_settlement_version: version });
    await refreshRooms();
    await Promise.all([refreshCredits(), refreshSettlements()]);
  };

  return <AppContext.Provider value={{
    data, user, balance, heldCredit, creditLoading, settlementRecords, settlementItems,
    mode: supabase ? 'supabase' : 'mock', isLoading,
    profile, profileError, mockAuthEnabled,
    retryProfile: () => { setProfileError(''); setProfileAttempt((attempt) => attempt + 1); },
    isAuthenticated: supabase ? Boolean(authUser) : Boolean(data.currentUserId),
    refreshRooms, refreshCredits, refreshSettlements, login, register, logout, updateProfile, createRoom, joinRoom,
    confirmRoom, prepareRoom, expireReadyCheck, cancelRoom, boardRoom, reportNoShow, charge, settleRoom,
    confirmSettlement, disputeSettlement, reviseFare, finalizeSettlement,
  }}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error('AppProvider가 필요합니다.');
  return context;
}
