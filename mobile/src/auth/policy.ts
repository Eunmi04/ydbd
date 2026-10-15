import type { AuthState, SignupInput } from './types';

export const SCHOOL_DOMAIN = 'jmail.ac.kr';
export const canPreview = (development: boolean, configured: boolean, state: AuthState) =>
  development && !configured && state.status === 'ready' && state.user === null;
export const normalizeEmail = (email: string) => email.trim().toLowerCase();
export const isSchoolEmail = (email: string) => /^[^\s@]+@jmail\.ac\.kr$/i.test(email.trim());
export function validateSignup(input: SignupInput): string | null {
  if (!input.nickname.trim()) return '닉네임을 입력해 주세요.';
  if (!isSchoolEmail(input.email)) return '중부대학교 @jmail.ac.kr 이메일을 입력해 주세요.';
  if (!input.password.trim()) return '비밀번호를 입력해 주세요.';
  if (!/^\+?[0-9]{9,15}$/.test(input.phone.replace(/[\s()-]/g, ''))) return '전화번호를 확인해 주세요.';
  return null;
}
export function accessFor(state: AuthState) {
  if (state.status !== 'ready') return state.status;
  if (!state.user) return 'guest';
  // Expiration is display-only: only the server can lift a suspension.
  if (state.user.accountStatus === 'suspended') return 'suspended';
  if (state.user.accountStatus !== 'active') return 'error';
  if (state.user.schoolVerification !== 'verified' || !isSchoolEmail(state.user.email)) return 'unverified';
  return 'allowed';
}
export function suspensionMessage(until: string | null, now = Date.now()): string {
  const end = until ? Date.parse(until) : NaN;
  if (!Number.isFinite(end)) return '이용이 중지된 회원입니다. 해제 일정은 관리자에게 문의해 주세요.';
  if (end <= now) return '이용 정지 종료 시각이 지났습니다. 상태를 다시 확인해 주세요.';
  const days = Math.ceil((end - now) / 86400000);
  return `약 ${days}일간 이용이 중지된 회원입니다. 종료 예정: ${new Date(end).toLocaleString('ko-KR')}`;
}
