'use strict';
const { parseDate, isOverdue } = require('./dates');

const PRIORITIES = ['high', 'medium', 'low'];
const STATUSES = ['open', 'done', 'all'];
const SORTS = ['due', 'priority', 'created', 'id'];

function parseId(id) {
  const n = typeof id === 'number' ? id : /^\d+$/.test(String(id).trim()) ? Number(id) : NaN;
  if (!Number.isInteger(n) || n < 1) throw new Error(`Invalid task id "${id}"`);
  return n;
}

function findTask(db, id) {
  const n = parseId(id);
  const t = db.tasks.find((x) => x.id === n);
  if (!t) throw new Error(`No task with id ${n}`);
  return t;
}

function addTask(db, { title, priority = 'medium', due = null, assignee = null, createdBy = null } = {}, now = new Date()) {
  const clean = typeof title === 'string' ? title.trim() : '';
  if (!clean) throw new Error('Title must not be empty');
  if (!PRIORITIES.includes(priority)) throw new Error(`Invalid priority "${priority}": use ${PRIORITIES.join('|')}`);
  const dueDate = due == null ? null : parseDate(due, now);
  const task = {
    id: db.nextId,
    title: clean,
    priority,
    due: dueDate,
    assignee: assignee || null,
    done: false,
    createdAt: now.toISOString(),
    completedAt: null,
    createdBy: createdBy || null,
  };
  db.nextId += 1;
  db.tasks.push(task);
  return task;
}

function completeTask(db, id, now = new Date()) {
  const t = findTask(db, id);
  if (!t.done) {
    t.done = true;
    t.completedAt = now.toISOString();
  }
  return t;
}

function deleteTask(db, id) {
  const t = findTask(db, id);
  db.tasks.splice(db.tasks.indexOf(t), 1);
  return t;
}

const prio = (t) => PRIORITIES.indexOf(t.priority);
const dueCmp = (a, b) => (a.due === b.due ? 0 : a.due === null ? 1 : b.due === null ? -1 : a.due < b.due ? -1 : 1);
const num = (a, b) => a - b;

function listTasks(db, opts = {}, today) {
  const { status = 'open', priority, assignee, overdue, dueBefore, sort, reverse } = opts;
  if (!STATUSES.includes(status)) throw new Error(`Invalid status "${status}": use ${STATUSES.join('|')}`);
  if (sort !== undefined && !SORTS.includes(sort)) throw new Error(`Invalid sort "${sort}": use ${SORTS.join('|')}`);
  if (priority !== undefined && !PRIORITIES.includes(priority)) throw new Error(`Invalid priority "${priority}"`);

  let out = db.tasks.filter((t) => {
    if (status === 'open' && t.done) return false;
    if (status === 'done' && !t.done) return false;
    if (priority && t.priority !== priority) return false;
    if (assignee && t.assignee !== assignee) return false;
    if (overdue && !isOverdue(t, today)) return false;
    if (dueBefore && !(t.due && t.due < dueBefore)) return false;
    return true;
  });

  let cmp;
  switch (sort) {
    case 'due': cmp = (a, b) => dueCmp(a, b) || num(prio(a), prio(b)) || num(a.id, b.id); break;
    case 'priority': cmp = (a, b) => num(prio(a), prio(b)) || dueCmp(a, b) || num(a.id, b.id); break;
    case 'created': cmp = (a, b) => (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0) || num(a.id, b.id); break;
    case 'id': cmp = (a, b) => num(a.id, b.id); break;
    default:
      cmp = (a, b) =>
        num(isOverdue(b, today), isOverdue(a, today)) || num(prio(a), prio(b)) || dueCmp(a, b) || num(a.id, b.id);
  }
  out = out.slice().sort(cmp);
  return reverse ? out.reverse() : out;
}

module.exports = { PRIORITIES, addTask, completeTask, deleteTask, listTasks, parseId };
