var test = require('tape');
var concat = require('concat-stream');
var staticModule = require('../');
var fs = require('fs');
var path = require('path');

test('nested object', function (t) {
    t.plan(3);
    
    var expected = [ 12, 555 ];
    var sm = staticModule({
        beep: {
            x: { y: { z: 4 } },
            f: { g: { h: function (n) { return n * 111 } } }
        }
    });
    readStream('source.js').pipe(sm).pipe(concat(function (body) {
        Function(['console'],body)({ log: log });
        t.equal(
            body.toString('utf8'),
            '\nconsole.log(4 * 3);\nconsole.log(555);\n'
        );
        function log (msg) { t.equal(msg, expected.shift()) }
    }));
});

function readStream (file) {
    return fs.createReadStream(path.join(__dirname, 'nested', file));
}
