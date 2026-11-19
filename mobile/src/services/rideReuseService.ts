import { requireSupabase } from './capstoneApi';
import { distinctRecentRoutes } from './routeReuse';

export type CompletedRoute = {
  room_id: string;
  departure: string;
  destination: string;
  boarded_at: string;
  departure_lat: number | null;
  departure_lng: number | null;
  destination_lat: number | null;
  destination_lng: number | null;
};

export type PreviousRider = { user_id: string; nickname: string };
export type ReceivedInvite = {
  id: string;
  room_id: string;
  sender_id: string;
  sender_name: string;
  departure: string;
  destination: string;
  departure_at: string;
  expires_at: string;
  status: 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'EXPIRED' | 'CLOSED' | 'FULL' | 'JOINED';
};

const messages: Record<string, string> = {
  INVITE_UNAVAILABLE: '이 초대를 보낼 수 없거나 더 이상 응답할 수 없어요.',
  ALREADY_JOINED: '이미 방에 참여했어요.',
  ROOM_NOT_OPEN: '이 방의 모집이 끝났어요.',
  ROOM_FULL: '이 방의 인원이 가득 찼어요.',
  AUTH_REQUIRED: '로그인이 필요해요.',
  ACCOUNT_RESTRICTED: '현재 계정으로는 이 기능을 사용할 수 없어요.',
};

async function rpc<T>(name: string, params?: Record<string, unknown>): Promise<T> {
  const { data, error } = await requireSupabase().rpc(name, params);
  if (error) throw new Error(messages[error.message] ?? '정보를 처리하지 못했어요. 잠시 후 다시 시도해 주세요.');
  return data as T;
}

type CompletedMembership = {
  boarded_at: string;
  room: Pick<CompletedRoute, 'departure_lat' | 'departure_lng' | 'destination_lat' | 'destination_lng'> & {
    id: string;
    departure_text: string;
    destination_text: string;
  };
};

async function readCompletedRoutes(roomId?: string): Promise<CompletedRoute[]> {
  const client = requireSupabase();
  const { data, error } = await client.rpc('get_my_completed_routes', { p_room_id: roomId ?? null });
  if (!error) return data as CompletedRoute[];
  if (error.code !== 'PGRST202') throw new Error('최근 이용 경로를 불러오지 못했어요.');

  // Older deployments already let members read their own finalized rides through RLS.
  const session = await client.auth.getSession();
  const userId = session.data.session?.user.id;
  if (session.error || !userId) throw new Error('최근 이용 경로를 보려면 로그인해 주세요.');
  const pageSize = roomId ? 1 : 100;
  let routes: CompletedRoute[] = [];
  for (let offset = 0; ; offset += pageSize) {
    const query = client.from('room_members')
      .select('boarded_at,room:rooms!inner(id,departure_text,destination_text,departure_lat,departure_lng,destination_lat,destination_lng)')
      .eq('user_id', userId)
      .eq('member_status', 'JOINED')
      .eq('boarded_status', 'BOARDED')
      .eq('room.status', 'SETTLED');
    if (roomId) query.eq('room_id', roomId);
    const page = await query.order('boarded_at', { ascending: false })
      .order('room_id', { ascending: false }).range(offset, offset + pageSize - 1);
    if (page.error) throw new Error('최근 이용 경로를 불러오지 못했어요.');
    const rows = page.data as unknown as CompletedMembership[];
    routes = distinctRecentRoutes([...routes, ...rows.map(({ boarded_at, room }) => ({
      room_id: room.id,
      departure: room.departure_text,
      destination: room.destination_text,
      departure_lat: room.departure_lat,
      departure_lng: room.departure_lng,
      destination_lat: room.destination_lat,
      destination_lng: room.destination_lng,
      boarded_at,
    }))]);
    if (roomId || routes.length === 3 || rows.length < pageSize) return routes;
  }
}

export const getRecentRoutes = () => readCompletedRoutes();
export const getCompletedRoute = async (roomId: string) =>
  (await readCompletedRoutes(roomId))[0] ?? null;
export const getPreviousRiders = (roomId: string) =>
  rpc<PreviousRider[]>('get_ride_reinvite_candidates', { p_room_id: roomId });
export const sendRideInvite = (roomId: string, sourceRoomId: string, recipientId: string) =>
  rpc<null>('send_ride_invite', { p_room_id: roomId, p_source_room_id: sourceRoomId, p_recipient_id: recipientId });
export const getReceivedInvites = () => rpc<ReceivedInvite[]>('get_my_ride_invites');
export const respondToRideInvite = (id: string, accept: boolean) =>
  rpc<string>('respond_to_ride_invite', { p_invite_id: id, p_accept: accept });
export const setInvitePreference = (optedIn: boolean) =>
  rpc<null>('set_ride_invite_preference', { p_opted_in: optedIn });
export const setInviteBlock = (senderId: string, blocked: boolean) =>
  rpc<null>('set_ride_invite_block', { p_sender_id: senderId, p_blocked: blocked });

export async function getInviteSettings() {
  const api = requireSupabase();
  const [preference, blocks] = await Promise.all([
    api.from('ride_invite_preferences').select('opted_in').maybeSingle(),
    rpc<{ blocked_user_id: string; nickname: string }[]>('get_my_ride_invite_blocks'),
  ]);
  if (preference.error) throw new Error('초대 설정을 불러오지 못했어요.');
  return {
    optedIn: preference.data?.opted_in ?? false,
    blocked: blocks,
  };
}
