var test = require('tape');
var concat = require('concat-stream');
var staticModule = require('../');
var fs = require('fs');
var path = require('path');

test('property', function (t) {
    t.plan(1);
    
    var sm = staticModule({
        fff: function (n) { return '[' + (n * 111) + ']' }
    });
    readStream('source.js').pipe(sm).pipe(concat(function (body) {
        Function(['console'],body)({ log: log });
        function log (msg) { t.deepEqual(msg, '[object Array]') }
    }));
});

function readStream (file) {
    return fs.createReadStream(path.join(__dirname, 'prop', file));
}
