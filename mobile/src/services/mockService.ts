import type { AppData, Room, Settlement, User } from '../types';

const today = new Date();
const departure = (days: number, hour: number, minute = 0) => {
  const date = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate() + days,
    hour,
    minute,
  );
  return date.toISOString();
};

export const testAccount = { email: 'minji@example.com', password: '1234' };

export const mockService = {
  initialData(): AppData {
    return {
      currentUserId: null,
      balances: { u1: 15000, u2: 15000, u3: 15000, u4: 15000 },
      users: [
        {
          id: 'u1',
          nickname: '민지',
          email: testAccount.email,
          password: testAccount.password,
          color: '#E7AD71',
        },
        {
          id: 'u2',
          nickname: '도윤',
          email: 'doyun@example.com',
          password: '1234',
          color: '#88BBA2',
        },
        {
          id: 'u3',
          nickname: '수아',
          email: 'sua@example.com',
          password: '1234',
          color: '#BFA5D9',
        },
        {
          id: 'u4',
          nickname: '현우',
          email: 'hyunwoo@example.com',
          password: '1234',
          color: '#91B8D7',
        },
      ],
      rooms: [
        {
          id: 'r1',
          departure: '삼송역',
          destination: '중부대학교',
          departureAt: departure(1, 9),
          maxMembers: 4,
          estimatedFare: 12000,
          hostId: 'u2',
          status: 'confirmed',
          members: [
            { userId: 'u2', boarded: true, deposit: 5000 },
            { userId: 'u3', boarded: true, deposit: 5000 },
            { userId: 'u1', boarded: false, deposit: 5000 },
          ],
        },
        {
          id: 'r2',
          departure: '중부대학교',
          destination: '화정역',
          departureAt: departure(1, 18, 30),
          maxMembers: 4,
          estimatedFare: 18000,
          hostId: 'u4',
          status: 'recruiting',
          members: [
            { userId: 'u4', boarded: false, deposit: 5000 },
            { userId: 'u3', boarded: false, deposit: 5000 },
          ],
        },
        {
          id: 'r3',
          departure: '원흥역',
          destination: '중부대학교',
          departureAt: departure(2, 8, 40),
          maxMembers: 3,
          estimatedFare: 13500,
          hostId: 'u2',
          status: 'recruiting',
          members: [{ userId: 'u2', boarded: false, deposit: 5000 }],
        },
        {
          id: 'r4',
          departure: '중부대학교',
          destination: '삼송역',
          departureAt: departure(2, 16),
          maxMembers: 4,
          estimatedFare: 12000,
          hostId: 'u3',
          status: 'recruiting',
          members: [
            { userId: 'u3', boarded: false, deposit: 5000 },
            { userId: 'u4', boarded: false, deposit: 5000 },
          ],
        },
        {
          id: 'r5',
          departure: '화정역',
          destination: '킨텍스',
          departureAt: departure(3, 11, 20),
          maxMembers: 4,
          estimatedFare: 20000,
          hostId: 'u4',
          status: 'recruiting',
          members: [{ userId: 'u4', boarded: false, deposit: 5000 }],
        },
      ],
      transactions: [
        {
          id: 't1',
          userId: 'u1',
          type: 'deposit',
          amount: -5000,
          title: '삼송역 → 중부대학교 예치',
          createdAt: departure(-1, 17),
        },
        {
          id: 't2',
          userId: 'u1',
          type: 'charge',
          amount: 20000,
          title: '포인트 충전',
          createdAt: departure(-2, 12),
        },
        {
          id: 't3',
          userId: 'u1',
          type: 'refund',
          amount: 1800,
          title: '이전 동승 잔액 환불',
          createdAt: departure(-5, 19),
        },
        {
          id: 't4',
          userId: 'u1',
          type: 'use',
          amount: -3200,
          title: '이전 동승 정산',
          createdAt: departure(-5, 19),
        },
      ],
      settlements: [
        {
          id: 's1',
          roomId: 'past1',
          userId: 'u1',
          actualFare: 12800,
          riderCount: 4,
          share: 3200,
          refund: 1800,
          createdAt: departure(-5, 19),
        },
        {
          id: 's2',
          roomId: 'past2',
          userId: 'u1',
          actualFare: 14400,
          riderCount: 4,
          share: 3600,
          refund: 1400,
          createdAt: departure(-10, 18),
        },
        {
          id: 's3',
          roomId: 'past3',
          userId: 'u1',
          actualFare: 12000,
          riderCount: 3,
          share: 4000,
          refund: 1000,
          createdAt: departure(-15, 9),
        },
      ],
    };
  },
  login(users: User[], email: string, password: string): User {
    const user = users.find(
      (item) =>
        item.email.toLowerCase() === email.trim().toLowerCase() &&
        item.password === password,
    );
    if (!user) throw new Error('이메일 또는 비밀번호를 확인해 주세요.');
    return user;
  },
  register(
    users: User[],
    nickname: string,
    email: string,
    password: string,
  ): User {
    if (!nickname.trim() || !email.includes('@') || password.length < 4)
      throw new Error('닉네임, 이메일, 비밀번호 4자 이상을 입력해 주세요.');
    if (
      users.some(
        (user) => user.email.toLowerCase() === email.trim().toLowerCase(),
      )
    )
      throw new Error('이미 사용 중인 이메일입니다.');
    return {
      id: `u${Date.now()}`,
      nickname: nickname.trim(),
      email: email.trim(),
      password,
      color: '#8DBD99',
    };
  },
  depositFor(room: Pick<Room, 'estimatedFare' | 'maxMembers'>): number {
    return Math.max(
      5000,
      Math.ceil(room.estimatedFare / room.maxMembers / 1000) * 1000,
    );
  },
  shareFor(fare: number, riderCount: number, riderIndex: number): number {
    return (
      Math.floor(fare / riderCount) + (riderIndex < fare % riderCount ? 1 : 0)
    );
  },
  settle(room: Room, userId: string, fare: number): Settlement {
    const boarded = room.members.filter((member) => member.boarded);
    if (!Number.isInteger(fare) || fare <= 0)
      throw new Error('실제 택시 요금을 원 단위로 입력해 주세요.');
    const riderIndex = boarded.findIndex((member) => member.userId === userId);
    if (riderIndex < 0) throw new Error('탑승 완료 후 정산할 수 있습니다.');
    const share = this.shareFor(fare, boarded.length, riderIndex);
    const deposit =
      room.members.find((member) => member.userId === userId)?.deposit ?? 0;
    if (share > deposit)
      throw new Error(
        '1인 부담액이 예치 포인트보다 큽니다. 더 낮은 요금을 입력해 주세요.',
      );
    return {
      id: `s${Date.now()}-${userId}`,
      roomId: room.id,
      userId,
      actualFare: fare,
      riderCount: boarded.length,
      share,
      refund: deposit - share,
      createdAt: new Date().toISOString(),
    };
  },
};
1;
