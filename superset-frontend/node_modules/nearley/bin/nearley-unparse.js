#!/usr/bin/env node

var fs = require('fs');
var nearley = require('../lib/nearley.js');
var opts = require('commander');
var randexp = require('randexp');
var Unparse = require('../lib/unparse.js');

var version = require('../package.json').version;
opts.version(version, '-v, --version')
    .arguments('<file.js>')
    .option('-s, --start [name]', 'An optional start symbol (if not provided then use the parser start symbol)', false)
    .option('-n, --count [n]', 'The number of samples to generate (separated by \\n).', 1)
    .option('-d, --depth [n]', 'The depth bound of each sample. Defaults to -1, which means "unbounded".', -1)
    .option('-o, --out [filename]', 'File to output to (defaults to stdout)')
    .parse(process.argv);

var output = opts.out ? fs.createWriteStream(opts.out) : process.stdout;

var grammar = new require(require('path').resolve(opts.args[0]));

// the main loop
for (var i=0; i<parseInt(opts.count); i++) {
    output.write(Unparse(grammar, opts.start ? opts.start : grammar.ParserStart, (opts.depth === -1) ? null : parseInt(opts.depth)));
    if (parseInt(opts.count) > 1) output.write("\n");
}
