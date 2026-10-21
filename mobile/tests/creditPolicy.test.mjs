import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateReserveAmount, isValidEstimatedFare, parseFareInput } from '../src/services/creditPolicy.ts';

test('fare input accepts positive integers and correctly grouped commas', () => {
  assert.deepEqual(parseFareInput('1'), { value: 1, error: null });
  assert.deepEqual(parseFareInput('5,000'), { value: 5000, error: null });
  assert.deepEqual(parseFareInput('9,007,199,254,740,991'), {
    value: Number.MAX_SAFE_INTEGER, error: null,
  });
});

test('fare input rejects zero, negative, decimal, exponent, bad grouping, and unsafe values', () => {
  for (const value of ['', '0', '-1', '1.5', '1e3', '12,34', '1,23,456',
    '1,0000', ' 1000', '9,007,199,254,740,992']) {
    const result = parseFareInput(value);
    assert.equal(result.value, null, value);
    assert.ok(result.error, value);
  }
  for (const value of [0, -1, 1.5, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    assert.equal(isValidEstimatedFare(value), false);
  }
});

test('reserve amount matches the SQL ceil/floor formula at boundaries', () => {
  assert.equal(calculateReserveAmount(1, 4), 5000);
  assert.equal(calculateReserveAmount(5000, 4), 5000);
  assert.equal(calculateReserveAmount(20000, 4), 5000);
  assert.equal(calculateReserveAmount(20001, 4), 6000);
  assert.equal(calculateReserveAmount(2000, 2), 5000);
  assert.equal(calculateReserveAmount(10001, 2), 6000);
  assert.equal(calculateReserveAmount(1000000000, 4), 250000000);
  assert.equal(calculateReserveAmount(Number.MAX_SAFE_INTEGER, 2), 4503599627371000);
  assert.equal(calculateReserveAmount(Number.MAX_SAFE_INTEGER, 3), 3002399751581000);
  assert.equal(calculateReserveAmount(Number.MAX_SAFE_INTEGER, 4), 2251799813686000);
});

test('reserve calculation rejects invalid fare or member count', () => {
  assert.throws(() => calculateReserveAmount(0, 4));
  assert.throws(() => calculateReserveAmount(1.5, 4));
  assert.throws(() => calculateReserveAmount(Number.MAX_SAFE_INTEGER + 1, 4));
  assert.throws(() => calculateReserveAmount(10000, 1));
  assert.throws(() => calculateReserveAmount(10000, 5));
});
