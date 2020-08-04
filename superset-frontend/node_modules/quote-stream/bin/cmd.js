#!/usr/bin/env node

var quote = require('../');
var minimist = require('minimist');
var fs = require('fs');

var argv = minimist(process.argv.slice(2), { alias: { h: 'help' } });
if (argv.help) {
    var s = fs.createReadStream(__dirname + '/usage.txt');
    return s.pipe(process.stdout);
}

process.stdin.pipe(quote()).pipe(process.stdout);
