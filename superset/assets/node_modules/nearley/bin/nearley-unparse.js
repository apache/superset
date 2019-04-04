#!/usr/bin/env node

var fs = require('fs');
var nearley = require('../lib/nearley.js');
var nomnom = require('nomnom');
var randexp = require('randexp');
var Unparse = require('../lib/unparse.js');

var opts = nomnom
    .script('nearley-unparse')
    .option('file', {
        position: 0,
        help: "A grammar .js file",
        required: true,
    })
    .option('start', {
        abbr: 's',
        help: "An optional start symbol (if not provided then use the parser start symbol)",
    })
    .option('count', {
        abbr: 'n',
        help: 'The number of samples to generate (separated by \\n).',
        default: 1
    })
    .option('depth', {
        abbr: 'd',
        help: 'The depth bound of each sample. Defaults to -1, which means "unbounded".',
        default: -1
    })
    .option('out', {
        abbr: 'o',
        help: "File to output to (defaults to stdout)",
    })
    .option('version', {
        abbr: 'v',
        flag: true,
        help: "Print version and exit",
        callback: function() {
            return require('../package.json').version;
        }
    })
    .parse();

var output = opts.out ? fs.createWriteStream(opts.out) : process.stdout;

var grammar = new require(require('path').resolve(opts.file));

// the main loop
for (var i=0; i<parseInt(opts.count); i++) {
    output.write(Unparse(grammar, opts.start ? opts.start : grammar.ParserStart, (opts.depth === -1) ? null : opts.depth));
    if (opts.count > 1) output.write("\n");
}
