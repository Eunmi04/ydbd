import type { SupabaseClient } from '@supabase/supabase-js';
import type { Profile } from '../types';

export function profileInput(nickname: string, school: string) {
  const name = nickname.trim();
  const schoolName = school.trim();
  if (!name || Array.from(name).length > 40) throw new Error('닉네임은 1~40자로 입력해 주세요.');
  if (Array.from(schoolName).length > 100) throw new Error('학교명은 100자 이내로 입력해 주세요.');
  return { nickname: name, school_name: schoolName || null };
}

export function serviceErrorMessage(cause: unknown): string {
  const error = cause as { code?: string; message?: string; status?: number } | null;
  if (/fetch|network|timeout/i.test(error?.message ?? '')) return '서버 연결에 실패했습니다. 연결 상태를 확인한 뒤 다시 시도해 주세요.';
  if (error?.code === '42501') return '저장 권한이 없습니다. 로그인 상태와 본인 프로필 접근 정책을 확인해 주세요. (42501)';
  if (error?.code === 'PGRST116') return '본인 프로필을 찾을 수 없거나 접근할 수 없습니다. 다시 로그인한 뒤 재시도해 주세요. (PGRST116)';
  if (error?.code === '23514') return '입력값이 DB의 허용 범위를 벗어났습니다. 닉네임·학교명·출발 시간·요금을 확인해 주세요. (23514)';
  if (error?.code === 'PGRST202') return '요청한 서버 함수를 찾을 수 없습니다. 적용한 마이그레이션과 RPC 인자를 확인해 주세요. (PGRST202)';
  if (error?.code === 'PGRST205') return '요청한 DB 테이블을 찾을 수 없습니다. 프로젝트 연결과 테이블 노출 상태를 확인해 주세요. (PGRST205)';
  if (error?.message && /[가-힣]/.test(error.message)) return error.message;
  const code = error?.code && /^[A-Za-z0-9_]{1,40}$/.test(error.code) ? ` (${error.code})` : '';
  return `요청을 처리하지 못했습니다. 로그인 상태와 서버 설정을 확인해 주세요.${code}`;
}

export async function saveMyProfile(client: SupabaseClient, userId: string, nickname: string, school: string): Promise<Profile> {
  // Explicit allowlist: never send email, verification, account status or balance.
  const patch = profileInput(nickname, school);
  const { data, error } = await client.from('profiles').update(patch).eq('id', userId).select('*').single();
  if (error) throw new Error(serviceErrorMessage(error));
  if (!data || data.id !== userId) throw new Error('저장 결과를 확인하지 못했습니다. 프로필을 다시 불러와 주세요.');
  return data as Profile;
}

export function verificationLabel(profile: Profile | null) {
  if (profile?.verification_status === 'VERIFIED') return profile.demo_verification
    ? '시연용 인증 상태 · 실제 본인 인증 아님' : '본인 인증 완료';
  return profile?.verification_status === 'PENDING' ? '본인 인증 확인 중' : '본인 인증 미완료';
}
