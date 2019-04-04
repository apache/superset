#!/usr/bin/env node
'use strict';
var fs = require('fs');
var strip = require('./index');
var input = process.argv[2];

if (process.argv.indexOf('-h') !== -1 || process.argv.indexOf('--help') !== -1) {
	console.log('strip-ansi <input file> > <output file>');
	console.log('or');
	console.log('cat <input file> | strip-ansi > <output file>');
	return;
}

if (process.argv.indexOf('-v') !== -1 || process.argv.indexOf('--version') !== -1) {
	console.log(require('./package').version);
	return;
}

if (input) {
	process.stdout.write(strip(fs.readFileSync(input, 'utf8')));
	return;
}

process.stdin.setEncoding('utf8');
process.stdin.on('data', function (data) {
	process.stdout.write(strip(data));
});
