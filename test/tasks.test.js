'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const T = require('../src/tasks');

const NOW = new Date(2025, 0, 30, 12);
const TODAY = '2025-01-30';
const empty = () => ({ version: 1, nextId: 1, tasks: [] });
const add = (db, title, o = {}) => T.addTask(db, { title, ...o }, NOW);

test('PRIORITIES', () => assert.deepEqual(T.PRIORITIES, ['high', 'medium', 'low']));

test('add defaults', () => {
  const db = empty();
  const t = add(db, 'x');
  assert.equal(t.priority, 'medium');
  assert.equal(t.due, null);
  assert.equal(t.assignee, null);
  assert.equal(t.createdBy, null);
  assert.equal(t.done, false);
  assert.equal(t.completedAt, null);
  assert.equal(t.createdAt, NOW.toISOString());
  assert.equal(db.tasks.length, 1);
});
test('add trims and validates', () => {
  const db = empty();
  assert.equal(add(db, '  hi  ').title, 'hi');
  assert.throws(() => add(db, ''));
  assert.throws(() => add(db, '   '));
  assert.throws(() => add(db, 'x', { priority: 'urgent' }));
  assert.throws(() => add(db, 'x', { due: '2025-02-30' }));
  assert.equal(db.tasks.length, 1);
});
test('add stores due/assignee/createdBy', () => {
  const t = add(empty(), 'x', { due: '2025-03-01', assignee: 'bob', createdBy: 'alice', priority: 'high' });
  assert.equal(t.due, '2025-03-01');
  assert.equal(t.assignee, 'bob');
  assert.equal(t.createdBy, 'alice');
  assert.equal(t.priority, 'high');
});
test('ids increment and are never reused', () => {
  const db = empty();
  assert.equal(add(db, 'a').id, 1);
  assert.equal(add(db, 'b').id, 2);
  T.deleteTask(db, 2);
  assert.equal(add(db, 'c').id, 3);
});

test('complete', () => {
  const db = empty();
  add(db, 'a');
  const t = T.completeTask(db, 1, NOW);
  assert.equal(t.done, true);
  assert.equal(t.completedAt, NOW.toISOString());
  const later = new Date(2025, 5, 1);
  const again = T.completeTask(db, 1, later);
  assert.equal(again.completedAt, NOW.toISOString());
  assert.equal(again.done, true);
  assert.equal(db.tasks[0].completedAt, NOW.toISOString()); // not re-stamped
});
test('complete unknown id', () => assert.throws(() => T.completeTask(empty(), 5, NOW)));
test('delete', () => {
  const db = empty();
  add(db, 'a');
  assert.equal(T.deleteTask(db, 1).title, 'a');
  assert.equal(db.tasks.length, 0);
  assert.throws(() => T.deleteTask(db, 1));
  assert.throws(() => T.deleteTask(db, 'abc'));
});

function seeded() {
  const db = empty();
  add(db, 'low-none', { priority: 'low' });                       // 1
  add(db, 'high-future', { priority: 'high', due: '2025-03-01' }); // 2
  add(db, 'med-overdue', { due: '2025-01-01' });                   // 3
  add(db, 'high-none', { priority: 'high', assignee: 'bob' });     // 4
  add(db, 'low-today', { priority: 'low', due: TODAY });           // 5
  add(db, 'done-one', { assignee: 'bob' });                        // 6
  T.completeTask(db, 6, NOW);
  return db;
}
const ids = (l) => l.map((t) => t.id);

test('list default: hides done; overdue, priority, due, id', () => {
  assert.deepEqual(ids(T.listTasks(seeded(), {}, TODAY)), [3, 2, 4, 5, 1]);
});
test('status filter', () => {
  const db = seeded();
  assert.deepEqual(ids(T.listTasks(db, { status: 'done' }, TODAY)), [6]);
  assert.equal(T.listTasks(db, { status: 'all' }, TODAY).length, 6);
});
test('filters', () => {
  const db = seeded();
  assert.deepEqual(ids(T.listTasks(db, { priority: 'high' }, TODAY)), [2, 4]);
  assert.deepEqual(ids(T.listTasks(db, { assignee: 'bob' }, TODAY)), [4]);
  assert.deepEqual(ids(T.listTasks(db, { assignee: 'bob', status: 'all' }, TODAY)), [4, 6]);
  assert.deepEqual(ids(T.listTasks(db, { overdue: true }, TODAY)), [3]);
  assert.deepEqual(ids(T.listTasks(db, { overdue: true, priority: 'high' }, TODAY)), []);
  assert.deepEqual(ids(T.listTasks(db, { dueBefore: '2025-02-01' }, TODAY)), [3, 5]);
});
test('sorts', () => {
  const db = seeded();
  assert.deepEqual(ids(T.listTasks(db, { sort: 'due' }, TODAY)), [3, 5, 2, 4, 1]);
  assert.deepEqual(ids(T.listTasks(db, { sort: 'priority' }, TODAY)), [2, 4, 3, 5, 1]);
  assert.deepEqual(ids(T.listTasks(db, { sort: 'id' }, TODAY)), [1, 2, 3, 4, 5]);
  assert.deepEqual(ids(T.listTasks(db, { sort: 'created' }, TODAY)), [1, 2, 3, 4, 5]);
  assert.deepEqual(ids(T.listTasks(db, { sort: 'id', reverse: true }, TODAY)), [5, 4, 3, 2, 1]);
});
test('created sort stable on equal timestamps, by id', () => {
  const db = seeded();
  assert.deepEqual(ids(T.listTasks(db, { sort: 'created', reverse: true }, TODAY)), [5, 4, 3, 2, 1]);
});
test('created sort follows createdAt, not id', () => {
  const db = empty();
  T.addTask(db, { title: 'late' }, new Date(2025, 0, 30));
  T.addTask(db, { title: 'early' }, new Date(2025, 0, 1));
  T.addTask(db, { title: 'mid' }, new Date(2025, 0, 15));
  assert.deepEqual(ids(T.listTasks(db, { sort: 'created' }, TODAY)), [2, 3, 1]);
  assert.deepEqual(ids(T.listTasks(db, { sort: 'created', reverse: true }, TODAY)), [1, 3, 2]);
});
test('list does not mutate', () => {
  const db = seeded();
  const snap = JSON.stringify(db);
  T.listTasks(db, { sort: 'priority', reverse: true, status: 'all' }, TODAY);
  assert.equal(JSON.stringify(db), snap);
});
test('list empty db, unicode', () => {
  assert.deepEqual(T.listTasks(empty(), {}, TODAY), []);
  const db = empty();
  add(db, 'café ☕ 日本語');
  assert.equal(T.listTasks(db, {}, TODAY)[0].title, 'café ☕ 日本語');
});
test('list rejects bad options', () => {
  assert.throws(() => T.listTasks(empty(), { sort: 'nope' }, TODAY));
  assert.throws(() => T.listTasks(empty(), { status: 'nope' }, TODAY));
  assert.throws(() => T.listTasks(empty(), { priority: 'nope' }, TODAY));
});
