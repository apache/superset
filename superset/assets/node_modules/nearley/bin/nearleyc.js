#!/usr/bin/env node

var fs = require('fs');
var nearley = require('../lib/nearley.js');
var nomnom = require('nomnom');
var Compile = require('../lib/compile.js');
var StreamWrapper = require('../lib/stream.js');

var opts = nomnom
    .script('nearleyc')
    .option('file', {
        position: 0,
        help: "An input .ne file (if not provided then read from stdin)",
    })
    .option('out', {
        abbr: 'o',
        help: "File to output to (defaults to stdout)",
    })
    .option('export', {
        abbr: 'e',
        help: "Variable to set the parser to",
        default: "grammar"
    })
    .option('quiet', {
        abbr: 'q',
        flag: true,
        help: "Suppress the linter."
    })
    .option('nojs', {
        flag: true,
        default: false,
        help: "Don't compile postprocessors (for testing)."
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

var version = require('../package.json').version;

var input = opts.file ? fs.createReadStream(opts.file) : process.stdin;
var output = opts.out ? fs.createWriteStream(opts.out) : process.stdout;

var parserGrammar = nearley.Grammar.fromCompiled(require('../lib/nearley-language-bootstrapped.js'));
var parser = new nearley.Parser(parserGrammar);
var generate = require('../lib/generate.js');
var lint = require('../lib/lint.js');

input
    .pipe(new StreamWrapper(parser))
    .on('finish', function() {
        parser.feed('\n');
        var c = Compile(
            parser.results[0],
            Object.assign({version: version}, opts)
        );
        if (!opts.quiet) lint(c, {'out': process.stderr, 'version': version});
        output.write(generate(c, opts.export));
    });
