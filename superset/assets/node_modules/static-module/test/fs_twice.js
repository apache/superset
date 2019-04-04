var staticModule = require('../');
var test = require('tape');
var concat = require('concat-stream');
var quote = require('quote-stream');
var through = require('through2');
var fs = require('fs');
var path = require('path');

test('fs.readFileSync twice', function (t) {
    var expected = [ 'EXTERMINATE\n', 'beep boop\n' ];
    t.plan(expected.length + 1);
    var sm = staticModule({
        fs: { readFileSync: readFileSync }
    }, { vars: { __dirname: __dirname + '/fs_twice' } });
    readStream('html.js').pipe(sm).pipe(concat(function (body) {
        t.equal(body.toString('utf8'),
            'var a = "EXTERMINATE\\n";\n'
            + 'var b = "beep boop\\n";\n'
            + 'console.log(a);\n'
            + 'console.log(b);\n'
        );
        Function(['console'],body)({ log: log });
        function log (msg) { t.equal(msg, expected.shift()) }
    }));
});

test('fs.readFileSync twice in vars', function (t) {
    var expected = [ 'EXTERMINATE\n', 'beep boop\n' ];
    t.plan(expected.length + 1);
    var sm = staticModule({
        fs: { readFileSync: readFileSync }
    }, { vars: { __dirname: __dirname + '/fs_twice' } });
    readStream('vars.js').pipe(sm).pipe(concat(function (body) {
        t.equal(body.toString('utf8').trim(),
            'var a = "EXTERMINATE\\n",\n'
            + '    b = "beep boop\\n";\n'
            + 'console.log(a);\n'
            + 'console.log(b);'
        );
        Function(['console'],body)({ log: log });
        function log (msg) { t.equal(msg, expected.shift()) }
    }));
});

test('fs.readFileSync 4x', function (t) {
    var expected = [
        'EXTERMINATE\n', 'beep boop\n', 'EXTERMINATE\n', 'beep boop\n'
    ];
    t.plan(expected.length + 1);
    var sm = staticModule({
        fs: { readFileSync: readFileSync }
    }, { vars: { __dirname: __dirname + '/fs_twice' } });
    readStream('4x.js').pipe(sm).pipe(concat(function (body) {
        t.equal(body.toString('utf8').trim(),
            'var a = "EXTERMINATE\\n";\n'
            + 'var b = "beep boop\\n";\n'
            + 'var c = "EXTERMINATE\\n";\n'
            + 'var d = "beep boop\\n";\n'
            + 'console.log(a);\n'
            + 'console.log(b);\n'
            + 'console.log(c);\n'
            + 'console.log(d);'
        );
        Function(['console'],body)({ log: log });
        function log (msg) { t.equal(msg, expected.shift()) }
    }));
});

function readStream (file) {
    return fs.createReadStream(path.join(__dirname, 'fs_twice', file));
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
