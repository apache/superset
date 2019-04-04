/* eslint-disable no-console */

const green = '\u001b[32m';
const white = '\u001b[22m\u001b[39m';
const boldCyan = '\u001b[96m\u001b[1m';
const reset = '\u001b[0m';

const output =
	green +
	'Have some ❤️ for fetch-mock? Why not donate to my charity of choice:' +
	white +
	'\n > ' +
	boldCyan +
	'https://www.justgiving.com/refugee-support-europe\n' +
	reset;

console.log(output);
