'use strict';
const os = require('node:os');
const { parseArgs } = require('node:util');
const store = require('./store');
const T = require('./tasks');
const { todayString, isOverdue, daysBetween } = require('./dates');

const USAGE = `Usage: todo <command> [options]

Commands:
  add <title> [-p high|medium|low] [-d DATE] [-a USER]
  list [--status open|done|all] [-p P] [-a USER] [--overdue]
       [--sort due|priority|created|id] [--reverse] [--json]
  done <id>
  delete <id>
  help

Global options:
  --file PATH   todo file (default: $TODO_FILE or ./.todo/todo.json)
  --user NAME   acting user (default: $TODO_USER or OS username)

DATE: YYYY-MM-DD, today, tomorrow, +Nd
`;

const OPTIONS = {
  file: { type: 'string' },
  user: { type: 'string' },
  priority: { type: 'string', short: 'p' },
  due: { type: 'string', short: 'd' },
  assignee: { type: 'string', short: 'a' },
  status: { type: 'string' },
  overdue: { type: 'boolean' },
  sort: { type: 'string' },
  reverse: { type: 'boolean' },
  json: { type: 'boolean' },
  help: { type: 'boolean', short: 'h' },
};

class UsageError extends Error {}

function osUser() {
  try { return os.userInfo().username; } catch { return null; }
}

function pad(s, w) {
  return s + ' '.repeat(Math.max(0, w - [...s].length));
}

function renderTable(tasks, today, color) {
  const rows = tasks.map((t) => {
    const od = isOverdue(t, today);
    let status = t.done ? 'done' : 'open';
    if (od) {
      const n = daysBetween(t.due, today);
      status = `[OVERDUE] ${n} ${n === 1 ? 'day' : 'days'}`;
    }
    return {
      od,
      cells: [String(t.id), t.priority[0].toUpperCase(), t.due || '-', t.assignee || '-', status, t.title],
    };
  });
  const header = ['ID', 'P', 'DUE', 'ASSIGNEE', 'STATUS', 'TITLE'];
  const widths = header.map((h, i) => Math.max(...[h, ...rows.map((r) => r.cells[i])].map((c) => [...c].length)));
  const line = (cells) => cells.map((c, i) => (i === cells.length - 1 ? c : pad(c, widths[i]))).join('  ');
  const out = [line(header)];
  for (const r of rows) {
    const l = line(r.cells);
    out.push(r.od && color ? `\x1b[31m${l}\x1b[0m` : l);
  }
  const m = rows.filter((r) => r.od).length;
  out.push('', `${rows.length} ${rows.length === 1 ? 'task' : 'tasks'}, ${m} overdue`);
  return out.join('\n') + '\n';
}

async function main(argv, io = {}) {
  const stdout = io.stdout || process.stdout;
  const stderr = io.stderr || process.stderr;
  const env = io.env || process.env;
  const cwd = io.cwd || process.cwd();
  const now = io.now || new Date();
  try {
    let parsed;
    try {
      parsed = parseArgs({ args: argv, options: OPTIONS, allowPositionals: true, strict: true });
    } catch (e) {
      throw new UsageError(e.message);
    }
    const { values: v, positionals } = parsed;
    const [cmd, ...rest] = positionals;
    if (cmd === 'help' || v.help) { stdout.write(USAGE); return 0; }
    if (!cmd) throw new UsageError('Missing command');

    const file = store.resolvePath({ file: v.file, env, cwd });
    const today = todayString(now);
    const user = v.user || env.TODO_USER || osUser();

    switch (cmd) {
      case 'add': {
        if (rest.length === 0) throw new UsageError('add: missing title');
        const db = store.load(file);
        const t = T.addTask(db, {
          title: rest.join(' '), priority: v.priority, due: v.due, assignee: v.assignee, createdBy: user,
        }, now);
        store.save(file, db);
        stdout.write(`Added task ${t.id}: ${t.title}\n`);
        return 0;
      }
      case 'list': {
        if (rest.length) throw new UsageError('list: unexpected argument');
        const db = store.load(file);
        const tasks = T.listTasks(db, {
          status: v.status, priority: v.priority, assignee: v.assignee,
          overdue: v.overdue, sort: v.sort, reverse: v.reverse,
        }, today);
        if (v.json) { stdout.write(JSON.stringify(tasks, null, 2) + '\n'); return 0; }
        if (tasks.length === 0) { stdout.write('No tasks found.\n'); return 0; }
        const color = Boolean(stdout.isTTY) && !env.NO_COLOR;
        stdout.write(renderTable(tasks, today, color));
        return 0;
      }
      case 'done':
      case 'delete': {
        if (rest.length !== 1) throw new UsageError(`${cmd}: expected exactly one id`);
        const db = store.load(file);
        if (cmd === 'done') {
          const id = T.parseId(rest[0]);
          const before = db.tasks.find((t) => t.id === id);
          const wasDone = Boolean(before && before.done);
          const t = T.completeTask(db, id, now);
          if (wasDone) { stdout.write(`Task ${t.id} is already done.\n`); return 0; }
          store.save(file, db);
          stdout.write(`Completed task ${t.id}: ${t.title}\n`);
        } else {
          const t = T.deleteTask(db, rest[0]);
          store.save(file, db);
          stdout.write(`Deleted task ${t.id}: ${t.title}\n`);
        }
        return 0;
      }
      default:
        throw new UsageError(`Unknown command "${cmd}"`);
    }
  } catch (e) {
    if (e instanceof UsageError) {
      stderr.write(`${e.message}\n\n${USAGE}`);
      return 2;
    }
    stderr.write(`Error: ${e.message}\n`);
    return 1;
  }
}

module.exports = { main, USAGE };
