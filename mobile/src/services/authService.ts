import type { SupabaseClient, User as AuthUser } from '@supabase/supabase-js';
import type { Profile } from '../types';

export const authSetupMessage = 'Supabase 연결 설정이 필요합니다. mobile/.env에 EXPO_PUBLIC_SUPABASE_URL과 EXPO_PUBLIC_SUPABASE_ANON_KEY를 설정하고 앱을 다시 시작해 주세요.';

export function validateLogin(email: string, password: string) {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) throw new Error('올바른 이메일 주소를 입력해 주세요.');
  if (!password) throw new Error('비밀번호를 입력해 주세요.');
}

export function validateSignup(nickname: string, email: string, password: string, confirmation: string) {
  validateLogin(email, password);
  if (!nickname.trim() || Array.from(nickname.trim()).length > 40) throw new Error('닉네임은 1~40자로 입력해 주세요.');
  if (password.length < 6) throw new Error('비밀번호는 6자 이상 입력해 주세요.');
  if (password !== confirmation) throw new Error('비밀번호와 비밀번호 확인이 일치하지 않습니다.');
}

export function authErrorMessage(cause: unknown): string {
  const error = cause as { code?: string; message?: string; status?: number } | null;
  const messages: Record<string, string> = {
    invalid_credentials: '이메일 또는 비밀번호가 올바르지 않습니다.',
    email_not_confirmed: '이메일 확인이 필요합니다. 확인 메일을 확인하거나 시연 프로젝트의 Confirm email 설정을 확인해 주세요.',
    user_already_exists: '이미 가입된 이메일입니다. 로그인해 주세요.',
    email_exists: '이미 가입된 이메일입니다. 로그인해 주세요.',
    signup_disabled: '현재 프로젝트에서 신규 가입이 비활성화되어 있습니다.',
    weak_password: '비밀번호가 서버의 보안 조건을 충족하지 않습니다. 더 길고 복잡한 비밀번호를 사용해 주세요.',
    email_address_invalid: '가입 가능한 이메일 주소를 입력해 주세요.',
    over_email_send_rate_limit: '확인 메일 요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.',
    over_request_rate_limit: '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.',
    user_banned: '이용이 제한된 계정입니다. 관리자에게 문의해 주세요.',
    unexpected_failure: '서버에서 가입을 처리하지 못했습니다. 관리자에게 프로필·지갑 생성 트리거와 DB 로그 확인을 요청해 주세요.',
  };
  if (error?.code && messages[error.code]) return messages[error.code];
  if (error?.status === 404 && /invalid path specified/i.test(error?.message ?? '')) {
    return 'Supabase URL이 올바르지 않습니다. mobile/.env의 EXPO_PUBLIC_SUPABASE_URL에는 https://프로젝트ID.supabase.co까지만 입력하고 /rest/v1/ 같은 경로는 제거한 뒤 앱을 다시 시작해 주세요.';
  }
  if (/fetch|network|timeout/i.test(error?.message ?? '')) return '서버에 연결하지 못했습니다. 인터넷 연결과 Supabase URL을 확인해 주세요.';
  if (error?.message && /[가-힣]/.test(error.message)) return error.message;
  return '요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요. 문제가 계속되면 Supabase 설정과 DB 적용 상태를 확인해 주세요.';
}

// Recovery accepts no user ID or account status from the client. The RPC uses auth.uid().
export async function loadOrRepairProfile(client: SupabaseClient, user: Pick<AuthUser, 'id'>): Promise<Profile> {
  const { data, error } = await client.from('profiles').select('*').eq('id', user.id).maybeSingle();
  if (error) throw new Error('프로필을 읽지 못했습니다. 연결 상태와 profiles 테이블·접근 정책을 확인한 뒤 다시 시도해 주세요.');
  if (data) return data as Profile;
  const repaired = await client.rpc('ensure_my_profile');
  if (repaired.error || !repaired.data || repaired.data.id !== user.id) {
    throw new Error('계정 로그인은 완료됐지만 프로필을 준비하지 못했습니다. 관리자에게 013 마이그레이션 적용을 요청한 뒤 프로필 다시 불러오기를 눌러 주세요. 다시 가입할 필요는 없습니다.');
  }
  return repaired.data as Profile;
}
