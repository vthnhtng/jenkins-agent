'use strict';

const pad = (n) => String(n).padStart(2, '0');

function fmt(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function todayString(now = new Date()) {
  return fmt(now);
}

function addDays(now, n) {
  if (!Number.isSafeInteger(n)) throw new Error('Invalid date offset');
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + n);
  const y = d.getFullYear();
  if (Number.isNaN(d.getTime()) || y < 1 || y > 9999) throw new Error('Invalid date: offset out of range');
  return fmt(d);
}

function parseDate(str, now = new Date()) {
  if (typeof str !== 'string') throw new Error('Invalid date: expected YYYY-MM-DD');
  const s = str.trim();
  if (s === 'today') return addDays(now, 0);
  if (s === 'tomorrow') return addDays(now, 1);
  let m = /^\+(\d+)d$/.exec(s);
  if (m) return addDays(now, Number(m[1]));
  m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) throw new Error(`Invalid date "${str}": expected YYYY-MM-DD, today, tomorrow or +Nd`);
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) {
    throw new Error(`Invalid date "${str}": no such calendar date`);
  }
  return s;
}

function isOverdue(task, today) {
  return Boolean(!task.done && task.due && task.due < today);
}

function daysBetween(from, to) {
  const p = (s) => { const [y, m, d] = s.split('-').map(Number); return Date.UTC(y, m - 1, d); };
  return Math.round((p(to) - p(from)) / 86400000);
}

module.exports = { parseDate, todayString, isOverdue, daysBetween };
