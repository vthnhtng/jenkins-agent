function normalizeName(name) {
  if (typeof name !== 'string') return 'World';
  const trimmed = name.trim();
  return trimmed === '' ? 'World' : trimmed;
}

function greet(name) {
  return `Hello, ${normalizeName(name)}!`;
}

function greetByTime(name, date = new Date()) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    throw new TypeError('date must be a valid Date');
  }
  const h = date.getHours();
  const period = h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
  return `${period}, ${normalizeName(name)}!`;
}

module.exports = { greet, greetByTime };
