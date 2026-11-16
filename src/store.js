'use strict';
const fs = require('node:fs');
const path = require('node:path');

const VERSION = 1;
const emptyDb = () => ({ version: VERSION, nextId: 1, tasks: [] });

function resolvePath({ file, env = {}, cwd = process.cwd() } = {}) {
  const p = file || env.TODO_FILE || path.join('.todo', 'todo.json');
  return path.resolve(cwd, p);
}

function load(p) {
  let raw;
  try {
    raw = fs.readFileSync(p, 'utf8');
  } catch (e) {
    if (e.code === 'ENOENT') return emptyDb();
    throw e;
  }
  let db;
  try {
    db = JSON.parse(raw);
  } catch (e) {
    throw new Error(`${p} is corrupt (invalid JSON: ${e.message}); refusing to overwrite it`);
  }
  if (!db || typeof db !== 'object' || db.version !== VERSION) {
    throw new Error(`${p}: unsupported version ${db && db.version}; expected ${VERSION}`);
  }
  if (!Array.isArray(db.tasks) || !Number.isInteger(db.nextId)) {
    throw new Error(`${p} is corrupt (missing tasks/nextId)`);
  }
  return db;
}

function save(p, db) {
  const dir = path.dirname(p);
  fs.mkdirSync(dir, { recursive: true });
  const tmp = path.join(dir, `.${path.basename(p)}.${process.pid}.${Date.now()}.tmp`);
  try {
    fs.writeFileSync(tmp, JSON.stringify(db, null, 2) + '\n');
    fs.renameSync(tmp, p);
  } catch (e) {
    fs.rmSync(tmp, { force: true });
    throw e;
  }
}

module.exports = { resolvePath, load, save, emptyDb };
