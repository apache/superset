var test = require('tape');
var concat = require('concat-stream');
var staticModule = require('../');
var fs = require('fs');
var path = require('path');

test('supported unary operator', function (t) {
    t.plan(1);

    var expected = [ false ];
    var sm = staticModule({
        beep: { x: 42 }
    });
    readStream('supported.js').pipe(sm).pipe(concat(function (body) {
        Function(['console'],body)({ log: log });
        function log (msg) { t.equal(msg, expected.shift()) }
    }));
});

test('unsupported unary operator', function (t) {
    t.plan(1)

    var sm = staticModule({
        beep: { x: 42 }
    });
    readStream('unsupported.js').pipe(sm).on('error', function (error) {
        t.equal(error.message, 'unsupported unary operator: typeof')
    })
})

function readStream (file) {
    return fs.createReadStream(path.join(__dirname, 'unary', file));
}
