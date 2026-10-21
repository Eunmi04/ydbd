import assert from 'node:assert/strict';
import test from 'node:test';
import { authErrorMessage, loadOrRepairProfile, validateLogin, validateSignup } from '../src/services/authService.ts';

test('signup validates email, nickname, password and confirmation without changing passwords', () => {
  assert.doesNotThrow(() => validateSignup(' 새 사용자 ', ' user@example.com ', ' secret ', ' secret '));
  for (const args of [
    ['이름', 'invalid', '123456', '123456'],
    [' ', 'a@example.com', '123456', '123456'],
    ['가'.repeat(41), 'a@example.com', '123456', '123456'],
    ['이름', 'a@example.com', '12345', '12345'],
    ['이름', 'a@example.com', '123456', '123456 '],
  ]) assert.throws(() => validateSignup(...args));
  assert.throws(() => validateLogin('a@example.com', ''));
  // Existing accounts can have passwords shorter than the signup minimum.
  assert.doesNotThrow(() => validateLogin('a@example.com', '1234'));
});

test('Auth plain-object errors become useful messages without exposing raw server details', () => {
  assert.match(authErrorMessage({ code: 'invalid_credentials' }), /이메일 또는 비밀번호/);
  assert.match(authErrorMessage({ code: 'email_not_confirmed' }), /이메일 확인/);
  assert.match(authErrorMessage({ code: 'weak_password' }), /보안 조건/);
  assert.match(authErrorMessage(new TypeError('Failed to fetch')), /연결/);
  assert.match(authErrorMessage({ status: 404, message: 'Invalid path specified in request URL' }), /URL.*rest\/v1/);
  const message = authErrorMessage({ message: 'database failure: private diagnostic' });
  assert.doesNotMatch(message, /private diagnostic/);
});

function profileClient(result, repairResult) {
  const calls = [];
  return {
    calls,
    from(table) {
      calls.push(['from', table]);
      return { select() { return { eq(column, id) {
        calls.push(['eq', column, id]);
        return { maybeSingle: async () => result };
      } }; } };
    },
    async rpc(...args) { calls.push(['rpc', ...args]); return repairResult; },
  };
}

test('existing profile is read using Auth UUID without writing metadata or status', async () => {
  const profile = { id: 'auth-uuid', nickname: '내 닉네임', verification_status: 'UNVERIFIED' };
  const client = profileClient({ data: profile, error: null });
  assert.equal(await loadOrRepairProfile(client, { id: 'auth-uuid' }), profile);
  assert.deepEqual(client.calls, [['from', 'profiles'], ['eq', 'id', 'auth-uuid']]);
});

test('missing profile uses caller-bound RPC without accepting an arbitrary ID', async () => {
  const profile = { id: 'auth-uuid', verification_status: 'UNVERIFIED' };
  const client = profileClient({ data: null, error: null }, { data: profile, error: null });
  assert.equal(await loadOrRepairProfile(client, { id: 'auth-uuid' }), profile);
  assert.deepEqual(client.calls.at(-1), ['rpc', 'ensure_my_profile']);
});

test('profile failure is recoverable and cannot silently enter the app with a fake profile', async () => {
  const missingRpc = profileClient({ data: null, error: null }, { data: null, error: { code: 'PGRST202' } });
  await assert.rejects(loadOrRepairProfile(missingRpc, { id: 'me' }), /013.*다시 가입할 필요는 없습니다/);
  const offline = profileClient({ data: null, error: { message: 'offline' } });
  await assert.rejects(loadOrRepairProfile(offline, { id: 'me' }), /프로필을 읽지 못했습니다/);
  assert.equal(offline.calls.some(([kind]) => kind === 'rpc'), false);
});
