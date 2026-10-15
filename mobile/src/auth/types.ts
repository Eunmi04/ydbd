import type { User } from '../types';

export type AuthUser = User & {
  phone: string;
  schoolVerification: 'unverified' | 'pending' | 'verified';
  accountStatus: 'active' | 'suspended';
  suspendedUntil: string | null;
};
export type SignupInput = { nickname: string; email: string; password: string; phone: string };
export type AuthState =
  | { status: 'loading' | 'error'; user: null }
  | { status: 'ready'; user: AuthUser | null };

// Adapter owns session persistence. Never expose credentials or tokens in user data.
export interface AuthClient {
  configured: boolean;
  restoreSession(): Promise<AuthUser | null>;
  login(email: string, password: string): Promise<AuthUser>;
  register(input: SignupInput): Promise<AuthUser>;
  logout(): Promise<void>;
  getMe(): Promise<AuthUser | null>;
  sendSchoolCode(): Promise<void>;
  verifySchoolCode(code: string): Promise<void>;
}

