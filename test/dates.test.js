'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { parseDate, todayString, isOverdue } = require('../src/dates');

const NOW = new Date(2025, 0, 30, 12, 0, 0); // local 2025-01-30

test('valid date', () => assert.equal(parseDate('2025-03-15'), '2025-03-15'));
test('invalid formats', () => {
  for (const s of ['2025/01/01', 'abc', '', '2025-1-1', '  ']) assert.throws(() => parseDate(s, NOW), Error, s);
  assert.throws(() => parseDate(undefined, NOW));
});
test('impossible dates', () => {
  assert.throws(() => parseDate('2025-02-30'));
  assert.throws(() => parseDate('2025-13-01'));
  assert.throws(() => parseDate('2025-00-10'));
});
test('leap days', () => {
  assert.equal(parseDate('2024-02-29'), '2024-02-29');
  assert.throws(() => parseDate('2025-02-29'));
});
test('today/tomorrow/+Nd', () => {
  assert.equal(parseDate('today', NOW), '2025-01-30');
  assert.equal(parseDate('tomorrow', NOW), '2025-01-31');
  assert.equal(parseDate('+3d', NOW), '2025-02-02');
  assert.equal(parseDate('+0d', NOW), '2025-01-30');
});
test('month/year rollover', () => {
  assert.equal(parseDate('tomorrow', new Date(2025, 11, 31, 23, 59)), '2026-01-01');
  assert.equal(parseDate('+1d', new Date(2024, 1, 28)), '2024-02-29');
  assert.equal(parseDate('+2d', new Date(2024, 1, 28)), '2024-03-01');
});
test('todayString is local', () => {
  assert.equal(todayString(new Date(2025, 4, 6, 23, 59)), '2025-05-06');
  assert.equal(todayString(new Date(2025, 4, 6, 0, 0)), '2025-05-06');
});
test('isOverdue', () => {
  const t = '2025-01-30';
  assert.equal(isOverdue({ done: false, due: '2025-01-29' }, t), true);
  assert.equal(isOverdue({ done: false, due: '2025-01-30' }, t), false);
  assert.equal(isOverdue({ done: false, due: '2025-02-01' }, t), false);
  assert.equal(isOverdue({ done: false, due: null }, t), false);
  assert.equal(isOverdue({ done: true, due: '2025-01-01' }, t), false);
});

test('parseDate rejects huge +Nd offsets', () => {
  assert.throws(() => parseDate('+99999999999d', NOW));
  assert.throws(() => parseDate('+99999999d', NOW));
  assert.throws(() => parseDate('+99999999999999999999d', NOW));
});
