var test = require('tape');
var concat = require('concat-stream');
var staticModule = require('../');
var fs = require('fs');
var path = require('path');

test('shebang', function (t) {
    t.plan(2);
    
    var expected = [ 12, 555 ];
    var sm = staticModule({
        beep: { x: 4, f: function (n) { return n * 111 } }
    });
    readStream('source.js').pipe(sm).pipe(concat(function (body) {
        Function(['console'],body)({ log: log });
        function log (msg) { t.equal(msg, expected.shift()) }
    }));
});

function readStream (file) {
    return fs.createReadStream(path.join(__dirname, 'shebang', file));
}
