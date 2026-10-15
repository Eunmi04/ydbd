import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { authClient, AUTH_UNAVAILABLE } from './client';
import { accessFor, canPreview, normalizeEmail, validateSignup } from './policy';
import type { AuthClient, AuthState, AuthUser, SignupInput } from './types';
import { supabase } from '../services/supabaseClient';
import { createSupabaseAuthClient } from './supabaseAdapter';

const defaultClient = supabase ? createSupabaseAuthClient(supabase) : authClient;

type AuthValue = {
  state: AuthState;
  access: ReturnType<typeof accessFor>;
  configured: boolean;
  previewAvailable: boolean;
  preview: boolean;
  startPreview(): void;
  login(email: string, password: string): Promise<void>;
  register(input: SignupInput): Promise<void>;
  logout(): Promise<void>;
  refresh(): Promise<void>;
  sendCode(): Promise<void>;
  verifyCode(code: string): Promise<void>;
};
const Context = createContext<AuthValue | null>(null);

export function AuthProvider({ children, client = defaultClient }: { children: React.ReactNode; client?: AuthClient }) {
  const [state, setState] = useState<AuthState>({ status: 'loading', user: null });
  const [previewRequested, setPreviewRequested] = useState(false);
  const previewAvailable = canPreview(__DEV__, client.configured, state);
  const preview = previewAvailable && previewRequested;
  const revision = useRef(0);
  useEffect(() => client.onSignOut?.(() => {
    revision.current++;
    setPreviewRequested(false);
    setState({ status: 'ready', user: null });
  }), [client]);
  const run = useCallback(async (request: () => Promise<AuthUser | null>) => {
    const current = ++revision.current;
    setState({ status: 'loading', user: null });
    try {
      const user = await request();
      if (current === revision.current) setState({ status: 'ready', user });
    } catch {
      if (current === revision.current) setState({ status: 'error', user: null });
    }
  }, []);
  useEffect(() => {
    let cancelled = false;
    const current = ++revision.current;
    void client.restoreSession().then(
      (user) => { if (!cancelled && current === revision.current) setState({ status: 'ready', user }); },
      () => { if (!cancelled && current === revision.current) setState({ status: 'error', user: null }); },
    );
    return () => { cancelled = true; };
  }, [client]);
  const refresh = useCallback(() => run(() => client.getMe()), [client, run]);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'active' && client.configured && state.status !== 'pending') void refresh();
    });
    return () => subscription.remove();
  }, [client, refresh, state.status]);
  const authenticate = async (request: () => Promise<AuthUser>) => {
    const current = ++revision.current;
    try {
      const user = await request();
      if (current === revision.current) setState({ status: 'ready', user });
    } catch (cause) {
      if (cause instanceof Error && cause.name === 'EmailConfirmationRequired' && current === revision.current) {
        setState({ status: 'pending', user: null, email: cause.message });
        return;
      }
      throw new Error(client.configured ? '인증 요청에 실패했습니다. 입력 정보를 확인하고 다시 시도해 주세요.' : AUTH_UNAVAILABLE);
    }
  };
  const logout = async () => {
    const current = ++revision.current;
    setPreviewRequested(false);
    setState({ status: 'ready', user: null });
    if (preview) return;
    try { await client.logout(); }
    catch {
      if (current === revision.current) setState({ status: 'error', user: null });
      throw new Error('로그아웃을 완료하지 못했습니다. 다시 시도해 주세요.');
    }
  };
  return <Context.Provider value={{
    state, access: accessFor(state), configured: client.configured,
    previewAvailable, preview,
    startPreview: () => { if (previewAvailable) setPreviewRequested(true); },
    login: (email, password) => authenticate(() => client.login(normalizeEmail(email), password)),
    register: async (input) => {
      const error = validateSignup(input);
      if (error) throw new Error(error);
      const current = ++revision.current;
      try {
        const email = normalizeEmail(input.email);
        const user = await client.register({ ...input, nickname: input.nickname.trim(), email, phone: input.phone.replace(/[\s()-]/g, '') });
        if (current === revision.current) setState(user ? { status: 'ready', user } : { status: 'pending', user: null, email });
      } catch {
        throw new Error(client.configured ? '가입 요청을 완료하지 못했습니다. 입력 정보와 메일 발송 설정을 확인해 주세요.' : AUTH_UNAVAILABLE);
      }
    },
    logout, refresh,
    sendCode: async () => {
      try { await client.sendSchoolCode(state.status === 'pending' ? state.email : state.user?.email); }
      catch { throw new Error(client.configured ? '인증 메일을 보내지 못했습니다. 잠시 후 다시 시도해 주세요.' : AUTH_UNAVAILABLE); }
    },
    verifyCode: async (code) => {
      if (!/^[0-9]+$/.test(code.trim())) throw new Error('메일에 적힌 숫자 코드를 입력해 주세요.');
      try { await client.verifySchoolCode(code.trim(), state.status === 'pending' ? state.email : state.user?.email); }
      catch { throw new Error(client.configured ? '코드가 올바르지 않거나 만료되었습니다.' : AUTH_UNAVAILABLE); }
      await refresh();
    },
  }}>{children}</Context.Provider>;
}
export function useAuth() {
  const value = useContext(Context);
  if (!value) throw new Error('AuthProvider가 필요합니다.');
  return value;
}
