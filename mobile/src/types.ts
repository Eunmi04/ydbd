export type User = { id: string; nickname: string; email: string; password: string; color: string };
export type RoomStatus = 'recruiting' | 'confirmed' | 'settled';
export type RoomMember = { userId: string; boarded: boolean; deposit: number };
export type Room = {
  id: string;
  departure: string;
  destination: string;
  departureAt: string;
  maxMembers: number;
  estimatedFare: number;
  hostId: string;
  status: RoomStatus;
  members: RoomMember[];
};
export type PointTransaction = {
  id: string;
  userId: string;
  type: 'charge' | 'deposit' | 'use' | 'refund';
  amount: number;
  title: string;
  createdAt: string;
};
export type Settlement = {
  id: string;
  roomId: string;
  userId: string;
  actualFare: number;
  riderCount: number;
  share: number;
  refund: number;
  createdAt: string;
};
export type AppData = {
  currentUserId: string | null;
  users: User[];
  rooms: Room[];
  balances: Record<string, number>;
  transactions: PointTransaction[];
  settlements: Settlement[];
};
