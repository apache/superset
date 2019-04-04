var quote = require('../');
var concat = require('concat-stream');
var test = require('tape');

test('whitespace', function (t) {
    t.plan(1);
    var q = quote();
    q.end('abc\ndef\tghi\r\n');
    
    q.pipe(concat(function (body) {
        t.equal(body.toString('utf8'), '"abc\\ndef\\tghi\\r\\n"');
    }));
});
