var test = require('tape');
var concat = require('concat-stream');
var staticModule = require('../');
var fs = require('fs');
var path = require('path');

test('assign', function (t) {
    t.plan(3);
    
    var expected = [ 12, 555 ];
    var sm = staticModule({
        beep: { x: 4, f: function (n) { return n * 111 } }
    });
    readStream('source.js').pipe(sm).pipe(concat(function (body) {
        t.equal(body.toString('utf8'),
            '\nconsole.log(4 * 3);'
            + '\nconsole.log(555);\n'
        );
        Function(['console'],body)({ log: log });
        function log (msg) { t.equal(msg, expected.shift()) }
    }));
});

test('assign comma', function (t) {
    t.plan(3);
    
    var expected = [ 12, 555 ];
    var sm = staticModule({
        beep: { x: 4, f: function (n) { return n * 111 } }
    });
    readStream('comma.js').pipe(sm).pipe(concat(function (body) {
        t.equal(body.toString('utf8'),
            'x = 5;\n'
            + 'console.log(4 * 3);\n'
            + 'console.log(555);\n'
        );
        Function(['console'],body)({ log: log });
        function log (msg) { t.equal(msg, expected.shift()) }
    }));
});

function readStream (file) {
    return fs.createReadStream(path.join(__dirname, 'assign', file));
}
