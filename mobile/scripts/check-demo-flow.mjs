// Run locally through Check-DemoFlow.ps1; passwords are never printed or saved.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
const makeClient = () => createClient(process.env.EXPO_PUBLIC_SUPABASE_URL, process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } });
const a = makeClient(), b = makeClient();
const check = (result, stage) => {
  if (result.error) throw new Error(`${stage}: ${result.error.code ?? result.error.status} ${result.error.message}`);
  return result.data;
};
const rpc = async (client, operation, payload) => check(await client.rpc(operation, { ...payload, p_request_id: randomUUID() }), operation);
let roomId;
try {
  if (!process.env.DEMO_PASSWORD_A || !process.env.DEMO_PASSWORD_B) throw new Error('Use scripts/Check-DemoFlow.ps1 to enter passwords locally.');
  const ua = check(await a.auth.signInWithPassword({ email: '1234@gmail.com', password: process.env.DEMO_PASSWORD_A }), 'login A').user;
  const ub = check(await b.auth.signInWithPassword({ email: '5678@gmail.com', password: process.env.DEMO_PASSWORD_B }), 'login B').user;
  for (const [client, user] of [[a, ua], [b, ub]]) {
    const p = check(await client.from('profiles').select('account_status,verification_status,demo_verification').eq('id', user.id).single(), 'demo profile');
    assert.ok(p.account_status === 'ACTIVE' && p.verification_status === 'VERIFIED' && p.demo_verification === true,
      'Apply migration 014 and the two-account demo seed first.');
  }
  const beforeA = check(await a.rpc('get_my_credit_summary'), 'balance A').available_credit;
  const beforeB = check(await b.rpc('get_my_credit_summary'), 'balance B').available_credit;
  assert.ok(beforeA >= 5000 && beforeB >= 5000, 'Each account needs at least 5000 TEST credits.');
  console.log('LOGIN_DEMO_MARKER_CREDIT_PASS');
  roomId = (await rpc(a, 'create_room', { p_departure_text: '시연 자동점검 출발', p_destination_text: '시연 자동점검 도착',
    p_departure_at: new Date(Date.now() + 86400000).toISOString(), p_max_members: 4, p_estimated_fare: 10000 })).room_id;
  const capacity = check(await a.from('rooms').select('min_members,max_members').eq('id', roomId).single(), 'capacity');
  assert.equal(capacity.min_members, 2); assert.equal(capacity.max_members, 4);
  await rpc(b, 'join_room', { p_room_id: roomId });
  console.log('CREATE_JOIN_PASS', roomId);
  await rpc(a, 'start_ready_check', { p_room_id: roomId });
  await rpc(a, 'prepare_member', { p_room_id: roomId });
  await rpc(b, 'prepare_member', { p_room_id: roomId });
  assert.equal(check(await a.from('rooms').select('status').eq('id', roomId).single(), 'fixed').status, 'FIXED');
  console.log('PREPARE_HOLD_FIXED_PASS');
  await rpc(a, 'mark_boarding', { p_room_id: roomId });
  await rpc(b, 'mark_boarding', { p_room_id: roomId });
  const settlement = await rpc(a, 'submit_fare', { p_room_id: roomId, p_actual_fare: 8000,
    p_evidence_type: 'SAMPLE', p_evidence_reference: '시연용 샘플 증빙 · 실제 결제 아님' });
  const payload = { p_settlement_id: settlement.settlement_id, p_settlement_version: settlement.settlement_version };
  // submit_fare already confirms the host's own item in the existing SQL.
  const hostItem = check(await a.from('settlement_items').select('confirmation_status')
    .eq('settlement_id', settlement.settlement_id).eq('user_id', ua.id).single(), 'host auto confirmation');
  assert.equal(hostItem.confirmation_status, 'CONFIRMED');
  await rpc(b, 'confirm_settlement', payload);
  await rpc(a, 'finalize_settlement', payload);
  assert.equal(check(await a.from('rooms').select('status').eq('id', roomId).single(), 'settled').status, 'SETTLED');
  const afterA = check(await a.rpc('get_my_credit_summary'), 'final balance A');
  const afterB = check(await b.rpc('get_my_credit_summary'), 'final balance B');
  assert.equal(afterA.available_credit, beforeA - 4000);
  assert.equal(afterB.available_credit, beforeB - 4000);
  assert.equal(afterA.held_credit, 0); assert.equal(afterB.held_credit, 0);
  console.log('BOARDING_FARE_CONFIRM_SETTLEMENT_LEDGER_PASS', settlement.settlement_id);
} finally {
  if (roomId) {
    const state = await a.from('rooms').select('status').eq('id', roomId).maybeSingle();
    if (['OPEN', 'READY_CHECK', 'FIXED'].includes(state.data?.status)) await rpc(a, 'cancel_room', { p_room_id: roomId });
    else if (state.data?.status && state.data.status !== 'SETTLED') console.log('INCOMPLETE_TEST_ROOM', roomId, state.data.status);
  }
  await Promise.all([a.auth.signOut({ scope: 'local' }), b.auth.signOut({ scope: 'local' })]);
}
