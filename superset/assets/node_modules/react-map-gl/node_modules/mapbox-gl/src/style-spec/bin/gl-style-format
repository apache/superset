#!/usr/bin/env node


var fs = require('fs'),
    argv = require('minimist')(process.argv.slice(2)),
    format = require('../').format;

if (argv.help || argv.h || (!argv._.length && process.stdin.isTTY)) {
    return help();
}

console.log(format(JSON.parse(fs.readFileSync(argv._[0])), argv.space));

function help() {
    console.log('usage:');
    console.log('  gl-style-format source.json > destination.json');
    console.log('');
    console.log('options:');
    console.log('  --space <num>');
    console.log('     Number of spaces in output (default "2")');
    console.log('     Pass "0" for minified output.');
}
