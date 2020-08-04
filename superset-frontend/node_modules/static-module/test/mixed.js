var test = require('tape');
var concat = require('concat-stream');
var quote = require('quote-stream');
var staticModule = require('../');
var fs = require('fs');
var path = require('path');

test('mixed nested objects and streams', function (t) {
    t.plan(4);
    
    var expected = [ 12, 'oh hello\n', 555 ];
    var sm = staticModule({
        beep: {
            x: { y: { z: 4 } },
            quote: {
                read: function (file) {
                    return fs.createReadStream(file).pipe(quote());
                }
            },
            f: { g: { h: function (n) { return n * 111 } } }
        }
    }, { vars: { __dirname: path.join(__dirname, 'mixed') } });
    readStream('source.js').pipe(sm).pipe(concat(function (body) {
        Function(['console'],body)({ log: log });
        t.equal(
            body.toString('utf8'),
            '\nconsole.log(4 * 3);'
            + '\nconsole.log("oh hello\\n");'
            + '\nconsole.log(555);\n'
        );
        function log (msg) { t.equal(msg, expected.shift()) }
    }));
});

test('mixed objects and streams', function (t) {
    t.plan(4);
    
    var expected = [ 12, 'oh hello\n', 555 ];
    var sm = staticModule({
        beep: {
            x: 4,
            quote: function (file) {
                return fs.createReadStream(file).pipe(quote());
            },
            f: function (n) { return n * 111 }
        }
    }, { vars: { __dirname: path.join(__dirname, 'mixed') } });
    readStream('unmixed.js').pipe(sm).pipe(concat(function (body) {
        Function(['console'],body)({ log: log });
        t.equal(
            body.toString('utf8'),
            '\nconsole.log(4 * 3);'
            + '\nconsole.log("oh hello\\n");'
            + '\nconsole.log(555);\n'
        );
        function log (msg) { t.equal(msg, expected.shift()) }
    }));
});

function readStream (file) {
    return fs.createReadStream(path.join(__dirname, 'mixed', file));
}
