#!/usr/bin/env node
const { greet } = require('./greetings');

console.log(greet(process.argv[2]));
