'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const store = require('../src/store');

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'todo-store-'));

test('load missing -> empty', () => {
  assert.deepEqual(store.load(path.join(tmp(), 'nope.json')), { version: 1, nextId: 1, tasks: [] });
});
test('save/load roundtrip, pretty JSON, parent dir, no temp leftovers', () => {
  const dir = tmp();
  const p = path.join(dir, 'a', 'b', 'todo.json');
  const db = { version: 1, nextId: 2, tasks: [{ id: 1, title: 't' }] };
  store.save(p, db);
  assert.deepEqual(store.load(p), db);
  const raw = fs.readFileSync(p, 'utf8');
  assert.equal(raw, JSON.stringify(db, null, 2) + '\n');
  assert.deepEqual(fs.readdirSync(path.dirname(p)), ['todo.json']);
});
test('overwrite works', () => {
  const p = path.join(tmp(), 'todo.json');
  store.save(p, { version: 1, nextId: 1, tasks: [] });
  store.save(p, { version: 1, nextId: 5, tasks: [] });
  assert.equal(store.load(p).nextId, 5);
});
test('corrupt JSON throws and leaves file intact', () => {
  const p = path.join(tmp(), 'todo.json');
  fs.writeFileSync(p, '{not json');
  assert.throws(() => store.load(p), /todo\.json|JSON|corrupt/i);
  assert.equal(fs.readFileSync(p, 'utf8'), '{not json');
});
test('unsupported version / bad shape throws', () => {
  const p = path.join(tmp(), 'todo.json');
  fs.writeFileSync(p, JSON.stringify({ version: 99, nextId: 1, tasks: [] }));
  assert.throws(() => store.load(p), /version/i);
  fs.writeFileSync(p, JSON.stringify({ version: 1, nextId: 1 }));
  assert.throws(() => store.load(p));
});
test('resolvePath precedence', () => {
  const cwd = '/work/proj';
  assert.equal(store.resolvePath({ file: '/x/a.json', env: { TODO_FILE: '/y/b.json' }, cwd }), '/x/a.json');
  assert.equal(store.resolvePath({ env: { TODO_FILE: '/y/b.json' }, cwd }), '/y/b.json');
  assert.equal(store.resolvePath({ env: {}, cwd }), path.join(cwd, '.todo', 'todo.json'));
  assert.equal(store.resolvePath({ file: 'rel.json', env: {}, cwd }), path.join(cwd, 'rel.json'));
});
