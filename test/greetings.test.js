const { test } = require('node:test');
const assert = require('node:assert/strict');
const { greet, greetByTime } = require('../src/greetings');

const at = (h, m = 0) => new Date(2024, 0, 15, h, m);

test('greet basic and trimming', () => {
  assert.equal(greet('Alice'), 'Hello, Alice!');
  assert.equal(greet('  Bob  '), 'Hello, Bob!');
  assert.equal(greet('Mary Ann'), 'Hello, Mary Ann!');
});

test('greet defaults to World', () => {
  for (const v of [undefined, null, '', '   ', '\t\n']) {
    assert.equal(greet(v), 'Hello, World!');
  }
  assert.equal(greet(), 'Hello, World!');
});

test('greet non-string input', () => {
  assert.equal(greet(42), 'Hello, World!');
});

test('greetByTime boundaries', () => {
  const cases = [
    [0, 0, 'morning'], [5, 0, 'morning'], [11, 59, 'morning'],
    [12, 0, 'afternoon'], [15, 0, 'afternoon'], [17, 59, 'afternoon'],
    [18, 0, 'evening'], [23, 59, 'evening'],
  ];
  for (const [h, m, p] of cases) {
    assert.equal(greetByTime('Alice', at(h, m)), `Good ${p}, Alice!`);
  }
});

test('greetByTime name handling', () => {
  assert.equal(greetByTime('', at(9)), 'Good morning, World!');
  assert.equal(greetByTime(undefined, at(9)), 'Good morning, World!');
  assert.equal(greetByTime('   ', at(9)), 'Good morning, World!');
  assert.equal(greetByTime('  Al ', at(9)), 'Good morning, Al!');
});

test('greetByTime default date', () => {
  assert.match(greetByTime('Al'), /^Good (morning|afternoon|evening), Al!$/);
});

test('greetByTime throws TypeError on invalid date', () => {
  assert.throws(() => greetByTime('Al', new Date('nope')), TypeError);
  assert.throws(() => greetByTime('Al', 'noon'), TypeError);
});
