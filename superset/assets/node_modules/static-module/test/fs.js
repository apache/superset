var staticModule = require('../');
var test = require('tape');
var concat = require('concat-stream');
var quote = require('quote-stream');
var through = require('through2');
var fs = require('fs');
var path = require('path');

test('fs.readFile', function (t) {
    t.plan(2);
    var sm = staticModule({
        fs: { readFile: readFile }
    }, { vars: { __dirname: __dirname + '/fs' } });
    readStream('readfile.js').pipe(sm).pipe(concat(function (body) {
        t.equal(body.toString('utf8').replace(/;/g,'').trim(),
            'process.nextTick(function(){(function (err, src) {\n'
            + '    console.log(src)\n'
            + '})(null,"beep boop\\n")})'
        );
        Function(['console'],body)({ log: log });
        function log (msg) { t.equal(msg, 'beep boop\n') }
    }));
});

test('fs.readFileSync', function (t) {
    t.plan(2);
    var sm = staticModule({
        fs: { readFileSync: readFileSync }
    }, { vars: { __dirname: __dirname + '/fs' } });
    readStream('html.js').pipe(sm).pipe(concat(function (body) {
        t.equal(body.toString('utf8'),
            'var html = "EXTERMINATE\\n";\n'
            + 'console.log(html);\n'
        );
        Function(['console'],body)({ log: log });
        function log (msg) { t.equal(msg, 'EXTERMINATE\n') }
    }));
});

function readStream (file) {
    return fs.createReadStream(path.join(__dirname, 'fs', file));
}

function readFile (file, cb) {
    var stream = through(write, end);
    stream.push('process.nextTick(function(){(' + cb + ')(null,');
    return fs.createReadStream(file).pipe(quote()).pipe(stream);
    
    function write (buf, enc, next) { this.push(buf); next() }
    function end (next) { this.push(')})'); this.push(null); next() }
}

function readFileSync (file, opts) {
    return fs.createReadStream(file).pipe(quote());
}
