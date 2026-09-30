import React, { createContext, useContext, useState } from 'react';
import { mockService } from '../services/mockService';
import type { AppData, Room, Settlement, User } from '../types';

type NewRoom = Pick<Room, 'departure' | 'destination' | 'departureAt' | 'maxMembers' | 'estimatedFare'>;
type AppContextValue = {
  data: AppData;
  user: User | undefined;
  balance: number;
  login: (email: string, password: string) => void;
  register: (nickname: string, email: string, password: string) => void;
  logout: () => void;
  createRoom: (input: NewRoom) => string;
  joinRoom: (id: string) => void;
  confirmRoom: (id: string) => void;
  boardRoom: (id: string) => void;
  charge: (amount: number) => void;
  settleRoom: (id: string, fare: number) => string;
};

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<AppData>(() => mockService.initialData());
  const user = data.users.find((item) => item.id === data.currentUserId);
  const balance = user ? data.balances[user.id] ?? 0 : 0;

  const login = (email: string, password: string) => {
    const nextUser = mockService.login(data.users, email, password);
    setData((previous) => ({ ...previous, currentUserId: nextUser.id }));
  };
  const register = (nickname: string, email: string, password: string) => {
    const nextUser = mockService.register(data.users, nickname, email, password);
    setData((previous) => ({ ...previous, users: [...previous.users, nextUser], balances: { ...previous.balances, [nextUser.id]: 15000 }, currentUserId: nextUser.id }));
  };
  const logout = () => setData((previous) => ({ ...previous, currentUserId: null }));

  const createRoom = (input: NewRoom) => {
    if (!user) throw new Error('로그인이 필요합니다.');
    if (!input.departure.trim() || !input.destination.trim()) throw new Error('출발지와 목적지를 입력해 주세요.');
    if (input.departure.trim() === input.destination.trim()) throw new Error('출발지와 목적지가 같을 수 없습니다.');
    if (!Number.isFinite(input.estimatedFare) || input.estimatedFare <= 0) throw new Error('예상 택시 요금을 입력해 주세요.');
    if (new Date(input.departureAt).getTime() <= Date.now()) throw new Error('미래의 출발 시간을 선택해 주세요.');
    const deposit = mockService.depositFor(input);
    if (balance < deposit) throw new Error('방을 만들 예치 포인트가 부족합니다. 지갑에서 충전해 주세요.');
    const id = `r${Date.now()}`;
    const room: Room = { ...input, id, departure: input.departure.trim(), destination: input.destination.trim(), hostId: user.id, status: 'recruiting', members: [{ userId: user.id, boarded: false, deposit }] };
    setData((previous) => ({
      ...previous,
      balances: { ...previous.balances, [user.id]: (previous.balances[user.id] ?? 0) - deposit },
      rooms: [room, ...previous.rooms],
      transactions: [{ id: `t${Date.now()}`, userId: user.id, type: 'deposit', amount: -deposit, title: `${room.departure} → ${room.destination} 예치`, createdAt: new Date().toISOString() }, ...previous.transactions],
    }));
    return id;
  };

  const joinRoom = (id: string) => {
    if (!user) throw new Error('로그인이 필요합니다.');
    const room = data.rooms.find((item) => item.id === id);
    if (!room) throw new Error('방을 찾을 수 없습니다.');
    if (room.status !== 'recruiting') throw new Error('모집이 끝난 방입니다.');
    if (room.members.some((member) => member.userId === user.id)) return;
    if (room.members.length >= room.maxMembers) throw new Error('모집 인원이 가득 찼습니다.');
    const deposit = mockService.depositFor(room);
    if (balance < deposit) throw new Error('포인트가 부족합니다. 지갑에서 충전해 주세요.');
    setData((previous) => ({
      ...previous,
      balances: { ...previous.balances, [user.id]: (previous.balances[user.id] ?? 0) - deposit },
      rooms: previous.rooms.map((item) => item.id === id ? { ...item, members: [...item.members, { userId: user.id, boarded: false, deposit }] } : item),
      transactions: [{ id: `t${Date.now()}`, userId: user.id, type: 'deposit', amount: -deposit, title: `${room.departure} → ${room.destination} 예치`, createdAt: new Date().toISOString() }, ...previous.transactions],
    }));
  };

  const confirmRoom = (id: string) => {
    const room = data.rooms.find((item) => item.id === id);
    if (!room || room.hostId !== user?.id) throw new Error('방장만 방을 확정할 수 있습니다.');
    if (room.members.length < 2) throw new Error('두 명 이상 참여해야 방을 확정할 수 있습니다.');
    setData((previous) => ({ ...previous, rooms: previous.rooms.map((item) => item.id === id ? { ...item, status: 'confirmed' } : item) }));
  };

  const boardRoom = (id: string) => {
    const room = data.rooms.find((item) => item.id === id);
    if (!room || room.status !== 'confirmed') throw new Error('확정된 방에서 탑승을 확인할 수 있습니다.');
    if (!room.members.some((member) => member.userId === user?.id)) throw new Error('참여한 방만 탑승을 확인할 수 있습니다.');
    setData((previous) => ({ ...previous, rooms: previous.rooms.map((item) => item.id === id ? { ...item, members: item.members.map((member) => member.userId === user?.id ? { ...member, boarded: true } : member) } : item) }));
  };

  const charge = (amount: number) => {
    if (!user || amount <= 0) throw new Error('충전 금액을 선택해 주세요.');
    setData((previous) => ({
      ...previous,
      balances: { ...previous.balances, [user.id]: (previous.balances[user.id] ?? 0) + amount },
      transactions: [{ id: `t${Date.now()}`, userId: user.id, type: 'charge', amount, title: '포인트 충전', createdAt: new Date().toISOString() }, ...previous.transactions],
    }));
  };

  const settleRoom = (id: string, fare: number) => {
    if (!user) throw new Error('로그인이 필요합니다.');
    const room = data.rooms.find((item) => item.id === id);
    if (!room || room.status !== 'confirmed') throw new Error('정산할 수 없는 방입니다.');
    const boarded = room.members.filter((member) => member.boarded);
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

  return <AppContext.Provider value={{ data, user, balance, login, register, logout, createRoom, joinRoom, confirmRoom, boardRoom, charge, settleRoom }}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error('AppProvider가 필요합니다.');
  return context;
}
