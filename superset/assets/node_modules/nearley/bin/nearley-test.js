#!/usr/bin/env node

/* eg. node bin/nearleythere.js examples/js/left.js --input "....."
   or, node bin/nearleythere.js examples/js/AycockHorspool.js --input "aa" 
 */

var fs = require('fs');
var nearley = require('../lib/nearley.js');
var nomnom = require('nomnom');
var StreamWrapper = require('../lib/stream.js');

var opts = nomnom
    .script('nearley-test')
    .option('file', {
        position: 0,
        help: "A grammar .js file",
        required: true,
    })
    .option('input', {
        abbr: 'i',
        help: "An input string to parse (if not provided then read from stdin)",
        type: 'string',
    })
    .option('start', {
        abbr: 's',
        help: "An optional start symbol (if not provided then use the parser start symbol)",
    })
    .option('out', {
        abbr: 'o',
        help: "File to output to (defaults to stdout)",
    })
    .option('quiet', {
        abbr: 'q',
        flag: true,
        help: "Output parse results only (hide Earley table)",
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

var filename = require('path').resolve(opts.file);
var grammar = nearley.Grammar.fromCompiled(require(filename));
if (opts.start) grammar.start = opts.start
var parser = new nearley.Parser(grammar, {
    keepHistory: true,
});

var writeTable = function (writeStream, parser) {
    writeStream.write("Table length: " + parser.table.length + "\n");
    writeStream.write("Number of parses: " + parser.results.length + "\n");
    writeStream.write("Parse Charts");
    parser.table.forEach(function (column, index) {
        writeStream.write("\nChart: " + index++ + "\n");
        var stateNumber = 0;
        column.states.forEach(function (state, stateIndex) {
            writeStream.write(stateIndex + ": " + state.toString() + "\n");
        })
    })
    writeStream.write("\n\nParse results: \n");
}

var writeResults = function (writeStream, parser) {
    writeStream.write(require('util').inspect(parser.results, {colors: !opts.quiet, depth: null}));
    writeStream.write("\n");
}

if (typeof(opts.input) === "undefined") {
    process.stdin
        .pipe(new StreamWrapper(parser))
        .on('finish', function() {
            if (!opts.quiet) writeTable(output, parser);
            writeResults(output, parser);
        });
} else {
    parser.feed(opts.input);
    if (!opts.quiet) writeTable(output, parser);
    writeResults(output, parser);
}

