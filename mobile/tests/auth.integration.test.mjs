// Opt-in live verification. Creates two accounts and leaves them for inspection.
// Never uses an admin key or logs passwords, tokens, or complete Auth responses.
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import test from 'node:test';
import { createClient } from '@supabase/supabase-js';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const emailA = process.env.AUTH_TEST_EMAIL_A;
const emailB = process.env.AUTH_TEST_EMAIL_B;
const enabled = Boolean(url && key && emailA && emailB);

test('live Supabase signup, profiles, relogin, persistence and RLS', {
  skip: enabled ? false : 'Supabase URL·공개 키·서로 다른 새 AUTH_TEST_EMAIL_A/B가 필요합니다. 실제 DB 검증은 실행하지 않았습니다.',
}, async () => {
  assert.notEqual(emailA, emailB, '서로 다른 신규 이메일 두 개가 필요합니다.');
  assert.ok(!key.startsWith('sb_secret_'), '공개 anon/publishable 키만 사용하세요.');
  const password = `Demo!${randomBytes(18).toString('hex')}`;
  const values = new Map();
  const storage = {
    getItem: (name) => values.get(name) ?? null,
    setItem: (name, value) => { values.set(name, value); },
    removeItem: (name) => { values.delete(name); },
  };
  const makeClient = (sessionStorage = storage) => createClient(url, key, {
    auth: { storage: sessionStorage, persistSession: true, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const clientA = makeClient();
  const clientB = makeClient({ getItem: () => null, setItem() {}, removeItem() {} });
  const check = (result, step) => {
    if (result.error) throw new Error(`${step}: ${result.error.code ?? result.error.status ?? '실패'}`);
    return result.data;
  };
  try {
    const a = check(await clientA.auth.signUp({ email: emailA, password, options: { data: { nickname: '시연회원A' } } }), 'A 가입');
    assert.ok(a.session, 'Confirm email 설정 때문에 자동 로그인되지 않았습니다. 설정을 확인하세요.');
    const b = check(await clientB.auth.signUp({ email: emailB, password, options: { data: { nickname: '시연회원B' } } }), 'B 가입');
    assert.ok(b.session, 'B 가입 세션이 없습니다.');
    const own = check(await clientA.from('profiles').select('*').eq('id', a.user.id).single(), 'A 프로필');
    assert.equal(own.nickname, '시연회원A');
    assert.equal(own.email, emailA);
    assert.equal(own.verification_status, 'UNVERIFIED');
    assert.equal(own.account_status, 'ACTIVE');
    const repaired = check(await clientA.rpc('ensure_my_profile'), '본인 프로필 복구 RPC');
    assert.equal(repaired.id, a.user.id);
    assert.equal(repaired.nickname, own.nickname);

    const other = check(await clientA.from('profiles').select('id').eq('id', b.user.id), '타인 조회');
    assert.deepEqual(other, []);
    const write = await clientA.from('profiles').update({ nickname: '변조시도' }).eq('id', b.user.id).select('id');
    assert.ok(write.error || write.data.length === 0, '타인 프로필 수정이 허용됐습니다.');
    const bProfile = check(await clientB.from('profiles').select('nickname').eq('id', b.user.id).single(), 'B 원본 확인');
    assert.equal(bProfile.nickname, '시연회원B');
    for (const patch of [{ verification_status: 'VERIFIED' }, { account_status: 'SUSPENDED' }]) {
      const forbidden = await clientA.from('profiles').update(patch).eq('id', a.user.id).select('id');
      assert.equal(forbidden.error?.code, '42501', '서버 소유 상태 변경 권한이 차단되어야 합니다.');
    }
    const ledgerWrite = await clientA.from('credit_ledger').insert({ user_id: a.user.id, entry_type: 'TEST_GRANT', amount: 100000 });
    assert.equal(ledgerWrite.error?.code, '42501', '일반 사용자의 원장 쓰기 권한이 차단되어야 합니다.');
    const walletWrite = await clientA.from('credit_wallets').update({ status: 'SUSPENDED' }).eq('user_id', a.user.id);
    assert.equal(walletWrite.error?.code, '42501', '일반 사용자의 지갑 상태 변경이 차단되어야 합니다.');

    check(await clientA.auth.signOut({ scope: 'local' }), '로그아웃');
    assert.equal((await clientA.auth.getSession()).data.session, null);
    const denied = await clientA.from('profiles').select('id').eq('id', a.user.id);
    assert.ok(denied.error || denied.data.length === 0, '로그아웃 후 프로필 조회가 허용됐습니다.');
    const anonymousRepair = await clientA.rpc('ensure_my_profile');
    assert.equal(anonymousRepair.error?.code, '42501', '로그아웃 후 프로필 복구 RPC가 차단되어야 합니다.');
    const wrong = await clientA.auth.signInWithPassword({ email: emailA, password: `${password}wrong` });
    assert.ok(wrong.error, '잘못된 비밀번호가 허용됐습니다.');
    const relogin = check(await clientA.auth.signInWithPassword({ email: emailA, password }), '재로그인');
    assert.equal(relogin.user.id, a.user.id);
    // Checks SDK persistence, not a physical device restart or router behavior.
    const restored = makeClient();
    assert.equal((await restored.auth.getSession()).data.session?.user.id, a.user.id);
    check(await restored.auth.signOut({ scope: 'local' }), '복원 세션 로그아웃');
  } finally {
    await Promise.all([clientA.auth.signOut({ scope: 'local' }), clientB.auth.signOut({ scope: 'local' })]);
  }
});
