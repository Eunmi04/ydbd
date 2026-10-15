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
  | { status: 'pending'; user: null; email: string }
  | { status: 'ready'; user: AuthUser | null };

// Adapter owns session persistence. Never expose credentials or tokens in user data.
export interface AuthClient {
  configured: boolean;
  restoreSession(): Promise<AuthUser | null>;
  login(email: string, password: string): Promise<AuthUser>;
  register(input: SignupInput): Promise<AuthUser | null>;
  logout(): Promise<void>;
  getMe(): Promise<AuthUser | null>;
  sendSchoolCode(email?: string): Promise<void>;
  verifySchoolCode(code: string, email?: string): Promise<void>;
  onSignOut?(callback: () => void): () => void;
}
