const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');

const script = path.join(__dirname, '..', 'src', 'index.js');
const run = (...args) => spawnSync(process.execPath, [script, ...args], { encoding: 'utf8' });

for (const [args, out] of [
  [['Jenkins'], 'Hello, Jenkins!\n'],
  [[], 'Hello, World!\n'],
  [[''], 'Hello, World!\n'],
  [['  Ann '], 'Hello, Ann!\n'],
]) {
  test(`CLI ${JSON.stringify(args)}`, () => {
    const r = run(...args);
    assert.equal(r.status, 0);
    assert.equal(r.stdout, out);
  });
}
