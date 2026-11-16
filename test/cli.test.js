'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { main } = require('../src/cli');

const NOW = new Date(2025, 0, 30, 12);

function setup() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'todo-cli-'));
  const file = path.join(dir, 'todo.json');
  const run = async (args, extra = {}) => {
    let out = '', err = '';
    const code = await main(args, {
      stdout: { write: (s) => { out += s; }, isTTY: extra.tty || false },
      stderr: { write: (s) => { err += s; } },
      env: { TODO_USER: 'tester', ...(extra.env || {}) },
      cwd: dir,
      now: NOW,
    });
    return { code, out, err };
  };
  return { dir, file, run, f: ['--file', file] };
}

test('add -> list -> done -> delete flow', async () => {
  const { run, f } = setup();
  let r = await run(['add', 'Write docs', '-p', 'high', '-d', '2025-02-01', '-a', 'bob', ...f]);
  assert.equal(r.code, 0);
  assert.match(r.out, /1/);
  r = await run(['list', ...f]);
  assert.equal(r.code, 0);
  assert.match(r.out, /Write docs/);
  assert.match(r.out, /bob/);
  assert.match(r.out, /2025-02-01/);
  assert.match(r.out, /1 tasks?, 0 overdue/);
  r = await run(['done', '1', ...f]);
  assert.equal(r.code, 0);
  r = await run(['list', ...f]);
  assert.match(r.out, /No tasks found\./);
  r = await run(['list', '--status', 'done', ...f]);
  assert.match(r.out, /Write docs/);
  r = await run(['delete', '1', ...f]);
  assert.equal(r.code, 0);
  r = await run(['list', '--status', 'all', ...f]);
  assert.match(r.out, /No tasks found\./);
});
test('createdBy from env and --user', async () => {
  const { run, f, file } = setup();
  await run(['add', 'a', ...f]);
  await run(['add', 'b', '--user', 'carol', ...f]);
  const db = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.equal(db.tasks[0].createdBy, 'tester');
  assert.equal(db.tasks[1].createdBy, 'carol');
});
test('overdue flagged; due today and done overdue not', async () => {
  const { run, f } = setup();
  await run(['add', 'late', '-d', '2025-01-28', ...f]);
  await run(['add', 'today', '-d', 'today', ...f]);
  await run(['add', 'finished', '-d', '2025-01-01', ...f]);
  await run(['done', '3', ...f]);
  const r = await run(['list', '--status', 'all', ...f]);
  const lines = r.out.split('\n');
  assert.ok(lines.find((l) => l.includes('late')).includes('[OVERDUE]'));
  assert.ok(!lines.find((l) => l.includes('today')).includes('[OVERDUE]'));
  assert.ok(!lines.find((l) => l.includes('finished')).includes('[OVERDUE]'));
  assert.match(r.out, /3 tasks, 1 overdue/);
  assert.match(lines.find((l) => l.includes('late')), /2 days/);
  assert.ok(lines.findIndex((l) => l.includes('late')) < lines.findIndex((l) => l.includes('today')));
});
test('--overdue filter', async () => {
  const { run, f } = setup();
  await run(['add', 'late', '-d', '2025-01-28', ...f]);
  await run(['add', 'fine', ...f]);
  const r = await run(['list', '--overdue', ...f]);
  assert.match(r.out, /late/);
  assert.doesNotMatch(r.out, /fine/);
});
test('--json output', async () => {
  const { run, f } = setup();
  await run(['add', 'a', ...f]);
  const r = await run(['list', '--json', ...f]);
  const arr = JSON.parse(r.out);
  assert.equal(arr.length, 1);
  assert.equal(arr[0].title, 'a');
});
test('color only on TTY and without NO_COLOR', async () => {
  const { run, f } = setup();
  await run(['add', 'late', '-d', '2025-01-28', ...f]);
  assert.doesNotMatch((await run(['list', ...f])).out, /\x1b\[/);
  assert.match((await run(['list', ...f], { tty: true })).out, /\x1b\[31m/);
  assert.doesNotMatch((await run(['list', ...f], { tty: true, env: { NO_COLOR: '1' } })).out, /\x1b\[/);
});
test('assignee filter', async () => {
  const { run, f } = setup();
  await run(['add', 'mine', '-a', 'bob', ...f]);
  await run(['add', 'other', '-a', 'amy', ...f]);
  const r = await run(['list', '-a', 'bob', ...f]);
  assert.match(r.out, /mine/);
  assert.doesNotMatch(r.out, /other/);
});
test('errors and exit codes', async () => {
  const { run, f } = setup();
  let r = await run(['bogus', ...f]);
  assert.equal(r.code, 2); assert.match(r.err, /usage/i);
  r = await run(['list', '--wat', ...f]);
  assert.equal(r.code, 2); assert.match(r.err, /usage/i);
  r = await run(['add', ...f]);
  assert.equal(r.code, 2);
  r = await run(['done', ...f]);
  assert.equal(r.code, 2);
  r = await run(['done', '99', ...f]);
  assert.equal(r.code, 1); assert.match(r.err, /99/);
  r = await run(['delete', 'abc', ...f]);
  assert.equal(r.code, 1);
  r = await run(['add', 'x', '-p', 'urgent', ...f]);
  assert.equal(r.code, 1);
  r = await run(['add', 'x', '-d', '2025-02-30', ...f]);
  assert.equal(r.code, 1);
  r = await run([]);
  assert.equal(r.code, 2);
  r = await run(['help']);
  assert.equal(r.code, 0); assert.match(r.out, /add/);
});
test('done twice is a notice, exit 0', async () => {
  const { run, f } = setup();
  await run(['add', 'a', ...f]);
  await run(['done', '1', ...f]);
  const r = await run(['done', '1', ...f]);
  assert.equal(r.code, 0);
  assert.match(r.out + r.err, /already/i);
});
test('corrupt file -> exit 1, file untouched', async () => {
  const { run, f, file } = setup();
  fs.writeFileSync(file, 'garbage');
  const r = await run(['add', 'x', ...f]);
  assert.equal(r.code, 1);
  assert.equal(fs.readFileSync(file, 'utf8'), 'garbage');
});
test('titles with spaces, quotes, leading dashes', async () => {
  const { run, f } = setup();
  assert.equal((await run(['add', ...f, '--', '-fix']) ).code, 0);
  assert.equal((await run(['add', 'say "hi" it\'s ok', ...f])).code, 0);
  const arr = JSON.parse((await run(['list', '--json', '--sort', 'id', ...f])).out);
  assert.deepEqual(arr.map((t) => t.title), ['-fix', 'say "hi" it\'s ok']);
});
test('default file is ./.todo/todo.json in cwd', async () => {
  const { run, dir } = setup();
  assert.equal((await run(['add', 'x'])).code, 0);
  assert.ok(fs.existsSync(path.join(dir, '.todo', 'todo.json')));
});

test('huge +Nd due is rejected and file unchanged', async () => {
  const { run, f, file } = setup();
  await run(['add', 'a', ...f]);
  const before = fs.readFileSync(file, 'utf8');
  const r = await run(['add', 'x', '-d', '+99999999d', ...f]);
  assert.equal(r.code, 1);
  assert.equal(fs.readFileSync(file, 'utf8'), before);
});

test('--help / -h prints usage with any command', async () => {
  const { run, f, file } = setup();
  for (const args of [['add', '--help'], ['list', '-h'], ['--help']]) {
    const r = await run([...args, ...f]);
    assert.equal(r.code, 0);
    assert.match(r.out, /Usage: todo/);
  }
  assert.equal(fs.existsSync(file), false);
});

test('list --sort, --reverse, -p, --status validation', async () => {
  const { run, f } = setup();
  await run(['add', 'a', '-p', 'low', ...f]);
  await run(['add', 'b', '-p', 'high', ...f]);
  let r = await run(['list', '--json', '--sort', 'priority', ...f]);
  assert.deepEqual(JSON.parse(r.out).map((t) => t.id), [2, 1]);
  r = await run(['list', '--json', '--sort', 'id', '--reverse', ...f]);
  assert.deepEqual(JSON.parse(r.out).map((t) => t.id), [2, 1]);
  r = await run(['list', '--json', '-p', 'low', ...f]);
  assert.deepEqual(JSON.parse(r.out).map((t) => t.id), [1]);
  r = await run(['list', '--status', 'bogus', ...f]);
  assert.notEqual(r.code, 0);
});
