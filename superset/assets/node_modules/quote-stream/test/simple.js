var quote = require('../');
var concat = require('concat-stream');
var test = require('tape');

test('simple', function (t) {
    t.plan(1);
    var q = quote();
    q.end('abc');
    
    q.pipe(concat(function (body) {
        t.equal(body.toString('utf8'), '"abc"');
    }));
});
