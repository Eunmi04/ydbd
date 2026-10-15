const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const Module = require('node:module');
const path = require('node:path');

// Compile isolated pure TS modules without adding a production runtime dependency.
function load(relative) {
  const filename = path.resolve(__dirname, relative);
  const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const instance = new Module(filename, module);
  instance.filename = filename;
  instance.paths = module.paths;
  instance._compile(code, filename);
  return instance.exports;
}
const { accessFor, canPreview, isSchoolEmail, validateSignup, suspensionMessage } = load('../src/auth/policy.ts');
const { authClient } = load('../src/auth/client.ts');
const user = { id: 'test', email: 'test@jmail.ac.kr', schoolVerification: 'verified', accountStatus: 'active', suspendedUntil: null };
const ready = (overrides = {}) => ({ status: 'ready', user: { ...user, ...overrides } });

test('preview is only available to guests in development with no backend', () => {
  const guest = { status: 'ready', user: null };
  assert.equal(canPreview(true, false, guest), true);
  assert.equal(canPreview(false, false, guest), false);
  assert.equal(canPreview(true, true, guest), false);
  assert.equal(canPreview(true, false, { status: 'loading', user: null }), false);
  assert.equal(canPreview(true, false, { status: 'error', user: null }), false);
  assert.equal(canPreview(true, false, ready({ accountStatus: 'suspended' })), false);
  assert.equal(canPreview(true, false, ready({ schoolVerification: 'unverified' })), false);
  assert.equal(accessFor(guest), 'guest');
});

test('school domain rejects suffix, subdomain and whitespace spoofing', () => {
  assert.equal(isSchoolEmail(' Student@JMAIL.AC.KR '), true);
  for (const email of ['a@jmail.ac.kr.evil.test', 'a@sub.jmail.ac.kr', 'a@@jmail.ac.kr', 'a b@jmail.ac.kr', 'a@example.com', '@jmail.ac.kr']) assert.equal(isSchoolEmail(email), false);
});
test('phone and all registration fields are mandatory', () => {
  const input = { nickname: 'Test', email: 'test@jmail.ac.kr', phone: '010-0000-0000', password: 'test-only-input' };
  assert.equal(validateSignup(input), null);
  for (const field of Object.keys(input)) assert.notEqual(validateSignup({ ...input, [field]: '' }), null);
  assert.notEqual(validateSignup({ ...input, phone: 'not-a-phone' }), null);
});
test('session restore, failed checks, guests and unverified accounts cannot access features', () => {
  assert.equal(accessFor({ status: 'loading', user: null }), 'loading');
  assert.equal(accessFor({ status: 'error', user: null }), 'error');
  assert.equal(accessFor({ status: 'ready', user: null }), 'guest');
  for (const schoolVerification of ['unverified', 'pending', undefined]) assert.equal(accessFor(ready({ schoolVerification })), 'unverified');
  assert.equal(accessFor(ready()), 'allowed');
  assert.equal(accessFor(ready({ email: 'test@example.com' })), 'unverified');
});
test('suspension takes precedence and never expires on client authority', () => {
  assert.equal(accessFor(ready({ accountStatus: 'suspended', schoolVerification: 'unverified' })), 'suspended');
  assert.equal(accessFor(ready({ accountStatus: 'suspended', suspendedUntil: '2000-01-01T00:00:00Z' })), 'suspended');
  assert.equal(accessFor(ready({ accountStatus: undefined })), 'error');
});
test('suspension message handles remaining days, expired and missing dates', () => {
  const now = Date.parse('2026-01-01T00:00:00Z');
  assert.match(suspensionMessage('2026-01-03T00:00:00Z', now), /2일/);
  assert.match(suspensionMessage('2025-01-01T00:00:00Z', now), /다시 확인/);
  for (const date of [null, 'invalid']) assert.match(suspensionMessage(date, now), /관리자/);
});
test('unconfigured adapter cannot create accounts, sessions or verified status', async () => {
  assert.equal(authClient.configured, false);
  assert.equal(await authClient.restoreSession(), null);
  for (const operation of ['login', 'register', 'getMe', 'sendSchoolCode', 'verifySchoolCode']) await assert.rejects(() => authClient[operation](), /준비 중/);
});
