#!/usr/bin/env node

try {
  var rr = require('railroad-diagrams');
} catch(e) {
  // optional dependency not fullfilled
  console.log('Error: When you installed nearley, the dependency "railroad-diagrams" failed to install. Try running "npm install -g nearley" to re-install nearley. If that doesn\'t fix the problem, please file an issue on the nearley GitHub repository.')
  process.exit(1)
}

var fs = require('fs');
var path = require('path');
var opts = require('commander');

var version = require('../package.json').version;
opts.version(version, '-v, --version')
    .arguments('<file.ne>')
    .option('-o, --out [filename.svg]', 'File to output to (default stdout).', false)
    .parse(process.argv);

var input = opts.args[0] ? fs.createReadStream(opts.args[0]) : process.stdin;
var output = opts.out ? fs.createWriteStream(opts.out) : process.stdout;

function railroad(grm) {
    var rules = {};
    grm.forEach(function(instr) {
        if (instr.rules) {
            if (!rules[instr.name]) {
                rules[instr.name] = [];
            }
            rules[instr.name] = rules[instr.name].concat(instr.rules);
        }
    });

    var style = fs.readFileSync(
        path.join(
            path.dirname(require.resolve('railroad-diagrams')),
            'railroad-diagrams.css'
        )
    );

    var diagrams = Object.keys(rules).map(function(r) {
        return [
          '<h1><code>' + r + '</code></h1>',
          '<div>',
            diagram(r).toString(),
          '</div>'
        ].join('\n');
    });

    function diagram(name) {
        var selectedrules = rules[name];
        var outer = {subexpression: selectedrules};

        function renderTok(tok) {
            // ctx translated to correct position already
            if (tok.subexpression) {
                return new rr.Choice(0, tok.subexpression.map(renderTok));
            } else if (tok.ebnf) {
                switch (tok.modifier) {
                case ":+":
                    return new rr.OneOrMore(renderTok(tok.ebnf));
                    break;
                case ":*":
                    return new rr.ZeroOrMore(renderTok(tok.ebnf));
                    break;
                case ":?":
                    return new rr.Optional(renderTok(tok.ebnf));
                    break;
                }
            } else if (tok.literal) {
                return new rr.Terminal(JSON.stringify(tok.literal));
            } else if (tok.mixin) {
                return new rr.Comment("Pas implementé.");
            } else if (tok.macrocall) {
                return new rr.Comment("Pas implementé.");
            } else if (tok.tokens) {
                return new rr.Sequence(tok.tokens.map(renderTok));
            } else if (typeof(tok) === 'string') {
                return new rr.NonTerminal(tok);
            } else if (tok.constructor === RegExp) {
                return new rr.Terminal(tok.toString());
            } else if (tok.token) {
                return new rr.Terminal(tok.token);
            } else {
                return new rr.Comment("[Unimplemented]");
            }
        }

        return new rr.Diagram([renderTok(outer)]);
    }

    return [
      '<!DOCTYPE html>',
      '<html>',
        '<head>',
          '<meta charset="UTF-8">',
          '<style type="text/css">',
            style.toString(),
          '</style>',
        '</head>',
        '<body>',
          diagrams.join('\n'),
        '</body>',
      '</html>'
    ].join('\n');
}

var nearley = require('../lib/nearley.js');
var StreamWrapper = require('../lib/stream.js');
var parserGrammar = nearley.Grammar.fromCompiled(require('../lib/nearley-language-bootstrapped.js'));
var parser = new nearley.Parser(parserGrammar);
input
    .pipe(new StreamWrapper(parser))
    .on('finish', function() {
        if (parser.results[0]) {
            output.write(railroad(parser.results[0]));
        } else {
            process.stderr.write('SyntaxError: unexpected EOF\n');
        }
    });
