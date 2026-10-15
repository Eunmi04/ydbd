import type { SupabaseClient } from '@supabase/supabase-js';
import type { AuthClient, AuthUser } from './types';
import { isSchoolEmail, normalizeEmail, validateSignup } from './policy';

// Reuse the team's client/session and profiles table. Never trust user metadata for roles.
export function createSupabaseAuthClient(client: SupabaseClient): AuthClient {
  const getMe = async (): Promise<AuthUser | null> => {
    const { data: session, error: sessionError } = await client.auth.getSession();
    if (sessionError) throw new Error('Session unavailable');
    if (!session.session) return null;
    const { data, error } = await client.auth.getUser();
    if (error) {
      if (error.status === 401 || error.status === 403) return null;
      throw new Error('Account unavailable');
    }
    if (!data.user) return null;
    const { data: profile, error: profileError } = await client.from('profiles').select('*').eq('id', data.user.id).single();
    if (profileError || !profile || profile.id !== data.user.id) throw new Error('Profile unavailable');
    const email = data.user.email ?? '';
    return {
      id: data.user.id, email, nickname: profile.nickname, color: '#8DBD99',
      phone: typeof data.user.user_metadata?.phone === 'string' ? data.user.user_metadata.phone : '',
      schoolVerification: profile.verification_status === 'VERIFIED' && !!data.user.email_confirmed_at && isSchoolEmail(email) ? 'verified' : 'unverified',
      accountStatus: profile.account_status === 'ACTIVE' ? 'active' : 'suspended',
      suspendedUntil: typeof profile.suspended_until === 'string' ? profile.suspended_until : null,
    };
  };
  return {
    configured: true, getMe, restoreSession: getMe,
    login: async (email, password) => {
      if (!isSchoolEmail(email)) throw new Error('School email required');
      const { error } = await client.auth.signInWithPassword({ email: normalizeEmail(email), password });
      if (error?.code === 'email_not_confirmed') {
        const pending = new Error(normalizeEmail(email));
        pending.name = 'EmailConfirmationRequired';
        throw pending;
      }
      if (error) throw new Error('Login failed');
      const user = await getMe();
      if (!user) throw new Error('Session unavailable');
      return user;
    },
    register: async (input) => {
      if (validateSignup(input) || input.password.length < 6 || input.nickname.trim().length > 40) throw new Error('Invalid signup');
      const { data, error } = await client.auth.signUp({ email: normalizeEmail(input.email), password: input.password,
        options: { data: { nickname: input.nickname.trim(), phone: input.phone } } });
      if (error) throw new Error('Signup failed');
      // Confirm Email enabled: no session until the email code is verified.
      return data.session ? getMe() : null;
    },
    logout: async () => {
      const { error } = await client.auth.signOut();
      if (error) throw new Error('Logout failed');
    },
    sendSchoolCode: async (email) => {
      if (!email || !isSchoolEmail(email)) throw new Error('School email required');
      const { error } = await client.auth.resend({ type: 'signup', email: normalizeEmail(email) });
      if (error) throw new Error('Email delivery failed');
    },
    verifySchoolCode: async (code, email) => {
      if (!email || !isSchoolEmail(email) || !/^[0-9]+$/.test(code)) throw new Error('Invalid verification');
      const { error } = await client.auth.verifyOtp({ email: normalizeEmail(email), token: code, type: 'email' });
      if (error) throw new Error('Code verification failed');
      // Do not set profiles.verification_status from the client. Server integration owns it.
    },
    onSignOut: (callback) => {
      const { data } = client.auth.onAuthStateChange((event) => { if (event === 'SIGNED_OUT') callback(); });
      return () => data.subscription.unsubscribe();
    },
  };
}
