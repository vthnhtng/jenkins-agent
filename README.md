# Greetings

Tiny dependency-free Node.js greeting library and CLI.

## CLI

```
node src/index.js Jenkins   # Hello, Jenkins!
node src/index.js           # Hello, World!
```

## Library

```js
const { greet, greetByTime } = require('./src/greetings');
greet('Alice');                          // "Hello, Alice!"
greetByTime('Alice', new Date(2024, 0, 15, 9)); // "Good morning, Alice!"
```

Names are trimmed; missing, non-string or blank names become `World`.
`greetByTime` throws `TypeError` for an invalid date.

## Tests

```
npm test
```
