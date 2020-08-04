var test = require('tape');
var concat = require('concat-stream');
var quote = require('quote-stream');
var staticModule = require('../');
var fs = require('fs');
var path = require('path');

test('many instances', function (t) {
    t.plan(2);
    
    var sm = staticModule({
        fs: { readFileSync: function (file) {
            return fs.createReadStream(file).pipe(quote());
        } }
    }, { vars: { __dirname: path.join(__dirname, 'many') } });
    readStream('source.js').pipe(sm).pipe(concat(function (body) {
        Function(['console'],body)({ log: log });
        t.equal(
            body.toString('utf8'),
            '\nvar a = "A!\\n";\n'
            + 'var b = "B!\\n";\n'
            + 'var c = "C!\\n";\n'
            + 'console.log(a + b + c);\n'
        );
        function log (msg) { t.equal(msg, 'A!\nB!\nC!\n') }
    }));
});

test('expansions inline', function (t) {
    t.plan(2);
    
    var sm = staticModule({
        fs: { readFileSync: function (file) {
            return fs.createReadStream(file).pipe(quote());
        } }
    }, { vars: { __dirname: path.join(__dirname, 'many') } });
    readStream('inline.js').pipe(sm).pipe(concat(function (body) {
        Function(['console'],body)({ log: log });
        t.equal(
            body.toString('utf8'),
            '\nvar a = "A!\\n",\n'
            + '    b = "B!\\n",\n'
            + '    c = "C!\\n"\n'
            + ';\n'
            + 'console.log(a + b + c);\n'
        );
        function log (msg) { t.equal(msg, 'A!\nB!\nC!\n') }
    }));
});

test('all inline', function (t) {
    t.plan(2);
    
    var sm = staticModule({
        fs: { readFileSync: function (file) {
            return fs.createReadStream(file).pipe(quote());
        } }
    }, { vars: { __dirname: path.join(__dirname, 'many') } });
    readStream('all_inline.js').pipe(sm).pipe(concat(function (body) {
        Function(['console'],body)({ log: log });
        t.equal(
            body.toString('utf8').replace(/;/g,''),
            'var a = "A!\\n",\n'
            + '    b = "B!\\n",\n'
            + '    c = "C!\\n"\n'
            + 'console.log(a + b + c)\n'
        );
        function log (msg) { t.equal(msg, 'A!\nB!\nC!\n') }
    }));
});

function readStream (file) {
    return fs.createReadStream(path.join(__dirname, 'many', file));
}
