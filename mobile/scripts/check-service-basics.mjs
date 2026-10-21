// Explicit live check. Creates two UNVERIFIED test users; never elevates them.
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { saveMyProfile } from '../src/services/profileService.ts';

const makeClient = () => createClient(process.env.EXPO_PUBLIC_SUPABASE_URL, process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } });
const a = makeClient(), b = makeClient();
const check = (result, stage) => {
  if (result.error) throw new Error(`${stage}: ${result.error.code ?? result.error.status}`);
  return result.data;
};
let roomId;
try {
  const password = `Check!${randomBytes(20).toString('hex')}`;
  const suffix = Date.now();
  const emailA = `basic-a-${suffix}@example.com`, emailB = `basic-b-${suffix}@example.com`;
  const ua = check(await a.auth.signUp({ email: emailA, password, options: { data: { nickname: '기본점검A' } } }), 'signup A');
  const ub = check(await b.auth.signUp({ email: emailB, password, options: { data: { nickname: '기본점검B' } } }), 'signup B');
  assert.ok(ua.session && ub.session);
  console.log('TEST_ACCOUNTS', emailA, emailB);
  const profile = await saveMyProfile(a, ua.user.id, '수정점검A', '저장점검학교');
  assert.equal(profile.verification_status, 'UNVERIFIED');
  check(await a.auth.signOut({ scope: 'local' }), 'logout');
  check(await a.auth.signInWithPassword({ email: emailA, password }), 'relogin');
  const restored = check(await a.from('profiles').select('*').eq('id', ua.user.id).single(), 'profile reload');
  assert.equal(restored.nickname, '수정점검A');
  assert.equal(restored.school_name, '저장점검학교');
  console.log('PROFILE_SAVE_RELOGIN_PASS');

  const other = await a.from('profiles').update({ nickname: '타인변경시도' }).eq('id', ub.user.id).select('id');
  assert.ok(other.error || other.data.length === 0);
  assert.equal(check(await b.from('profiles').select('nickname').eq('id', ub.user.id).single(), 'other profile').nickname, '기본점검B');
  for (const patch of [{ verification_status: 'VERIFIED' }, { account_status: 'SUSPENDED' }, { email: 'changed@example.com' }, { demo_verification: true }]) {
    assert.equal((await a.from('profiles').update(patch).eq('id', ua.user.id)).error?.code, '42501');
  }
  console.log('PROFILE_RLS_AND_SERVER_FIELDS_PASS');

  const created = check(await a.rpc('create_room', {
    p_request_id: randomUUID(), p_departure_text: '기본점검 출발역', p_destination_text: '기본점검 도착학교',
    p_departure_at: new Date(Date.now() + 86400000).toISOString(), p_max_members: 2, p_estimated_fare: 10000,
  }), 'create room');
  roomId = created.room_id;
  assert.equal(check(await a.from('rooms').select('host_id,status').eq('id', roomId).single(), 'room read').host_id, ua.user.id);
  check(await b.rpc('join_room', { p_room_id: roomId, p_request_id: randomUUID() }), 'join room');
  assert.equal(check(await a.from('room_members').select('user_id').eq('room_id', roomId), 'members').length, 2);
  const denied = await a.rpc('start_ready_check', { p_room_id: roomId, p_request_id: randomUUID() });
  assert.match(denied.error?.message ?? '', /ACCOUNT_RESTRICTED/);
  console.log('UNVERIFIED_CREATE_JOIN_PASS', roomId);
  console.log('UNVERIFIED_READY_CHECK_DENIED_PASS');
} finally {
  if (roomId) check(await a.rpc('cancel_room', { p_room_id: roomId, p_request_id: randomUUID() }), 'cancel test room');
  await Promise.all([a.auth.signOut({ scope: 'local' }), b.auth.signOut({ scope: 'local' })]);
}
