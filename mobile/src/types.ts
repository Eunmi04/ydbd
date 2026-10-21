export type User = { id: string; nickname: string; email: string; password?: string; color: string };
export type RoomStatus = 'recruiting' | 'confirmed' | 'settled' | 'other';
export type RoomMember = { userId: string; boarded: boolean; deposit: number; ready?: boolean; boardedStatus?: BoardedStatus };
export type Room = {
  id: string;
  departure: string;
  destination: string;
  departureAt: string;
  maxMembers: number;
  estimatedFare: number;
  hostId: string;
  status: RoomStatus;
  dbStatus?: DbRoomStatus;
  readyDeadlineAt?: string | null;
  memberCountKnown?: boolean;
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

// Phase 3 Supabase records. Legacy mock types above remain for local demo mode.
export type VerificationStatus = 'UNVERIFIED' | 'PENDING' | 'VERIFIED' | 'REJECTED';
export type AccountStatus = 'ACTIVE' | 'RESTRICTED' | 'SUSPENDED' | 'CLOSED';
export type PhoneVisibility = 'PRIVATE' | 'CONSENTED';
export type DbRoomStatus = 'OPEN' | 'READY_CHECK' | 'FIXED' | 'IN_PROGRESS'
  | 'FARE_SUBMITTED' | 'CONFIRMING' | 'SETTLING' | 'DISPUTED'
  | 'SETTLED' | 'CANCELLED';
export type MemberStatus = 'JOINED' | 'LEFT' | 'REMOVED';
export type ReadyStatus = 'NOT_READY' | 'READY';
export type BoardedStatus = 'UNKNOWN' | 'BOARDED' | 'NO_SHOW';
export type MemberRole = 'HOST' | 'MEMBER';
export type Profile = {
  id: string; nickname: string; email: string | null; school_name: string | null;
  verification_status: VerificationStatus; account_status: AccountStatus;
  phone_visibility: PhoneVisibility; created_at: string; updated_at: string;
  demo_verification?: boolean;
};
export type RoomRecord = {
  id: string; host_id: string; departure_text: string; destination_text: string;
  departure_lat: number | null; departure_lng: number | null;
  destination_lat: number | null; destination_lng: number | null;
  departure_at: string; min_members: number; max_members: number;
  estimated_fare: number; status: DbRoomStatus;
  ready_started_at: string | null; ready_deadline_at: string | null;
  created_at: string; updated_at: string;
};
export type RoomMemberRecord = {
  id: string; room_id: string; user_id: string; role: MemberRole;
  member_status: MemberStatus; ready_status: ReadyStatus;
  boarded_status: BoardedStatus; joined_at: string;
  ready_at: string | null; boarded_at: string | null; left_at: string | null;
};

export type CreditLedgerRecord = {
  id: string; user_id: string; room_id: string | null; settlement_id: string | null;
  entry_type: 'TEST_GRANT' | 'ROOM_HOLD' | 'ROOM_RELEASE' | 'SETTLEMENT_DEBIT' | 'ADMIN_ADJUSTMENT';
  amount: number; created_at: string;
};
export type CreditReservationRecord = {
  id: string; room_id: string; user_id: string; amount: number;
  status: 'HELD' | 'RELEASED' | 'CAPTURED'; created_at: string;
};
export type SettlementRecord = {
  id: string; room_id: string; settlement_version: number; actual_fare: number;
  status: 'DRAFT' | 'CONFIRMING' | 'DISPUTED' | 'COMPLETED' | 'CANCELLED';
  evidence_type: string | null; evidence_reference: string | null;
  created_at: string; completed_at: string | null;
};
export type SettlementItemRecord = {
  id: string; settlement_id: string; user_id: string;
  deposit_amount: number; share_amount: number; refund_amount: number;
  boarded: boolean; confirmation_status: 'PENDING' | 'CONFIRMED' | 'DISPUTED' | 'INVALIDATED';
  confirmation_version: number;
};
