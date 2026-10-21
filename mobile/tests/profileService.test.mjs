import assert from 'node:assert/strict';
import test from 'node:test';
import { profileInput, saveMyProfile, serviceErrorMessage, verificationLabel } from '../src/services/profileService.ts';

test('only editable profile fields are normalized and validated', () => {
  assert.deepEqual(profileInput(' 새 이름 ', ' 학교 '), { nickname: '새 이름', school_name: '학교' });
  assert.deepEqual(profileInput('새 이름', ' '), { nickname: '새 이름', school_name: null });
  assert.throws(() => profileInput(' ', '학교'));
  assert.throws(() => profileInput('가'.repeat(41), '학교'));
  assert.throws(() => profileInput('이름', '가'.repeat(101)));
});

test('profile save binds the Auth UUID and uses confirmed server data', async () => {
  const calls = [];
  const saved = { id: 'me', nickname: '저장된 이름', school_name: '학교', verification_status: 'UNVERIFIED' };
  const client = { from(table) { calls.push(table); return { update(patch) {
    calls.push(patch); return { eq(column, id) { calls.push([column, id]); return { select() {
      return { single: async () => ({ data: saved, error: null }) };
    } }; } };
  } }; } };
  assert.equal(await saveMyProfile(client, 'me', '저장된 이름', '학교'), saved);
  assert.deepEqual(calls, ['profiles', { nickname: '저장된 이름', school_name: '학교' }, ['id', 'me']]);
});

test('permission and schema errors explain the cause without exposing server diagnostics', () => {
  assert.match(serviceErrorMessage({ code: '42501', message: 'sensitive internal' }), /권한.*42501/);
  assert.match(serviceErrorMessage({ code: 'PGRST202' }), /서버 함수/);
  assert.doesNotMatch(serviceErrorMessage({ code: 'XX000', message: 'secret internal' }), /secret internal/);
});

test('admin-marked demo verification is not presented as real identity verification', () => {
  assert.match(verificationLabel({ verification_status: 'VERIFIED', demo_verification: true }), /시연용.*실제 본인 인증 아님/);
  assert.equal(verificationLabel({ verification_status: 'UNVERIFIED', demo_verification: true }), '본인 인증 미완료');
});
