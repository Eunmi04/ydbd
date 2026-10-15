import type { AuthClient } from './types';

export const AUTH_UNAVAILABLE = '인증 서비스 연결을 준비 중입니다. 현재 회원가입·로그인·인증 메일 발송을 이용할 수 없습니다.';
const unavailable = async (): Promise<never> => { throw new Error(AUTH_UNAVAILABLE); };

// Replace this adapter when the team selects a backend. No simulated success.
export const authClient: AuthClient = {
  configured: false,
  restoreSession: async () => null,
  login: unavailable,
  register: unavailable,
  logout: async () => {},
  getMe: unavailable,
  sendSchoolCode: unavailable,
  verifySchoolCode: unavailable,
};

