var test = require('tape');
var inspect = require('../');

var obj = { x: 'a\r\nb', y: '\5! \x1f \022' };

test('interpolate low bytes', function (t) {
    t.plan(1);
    t.equal(
        inspect(obj),
        "{ x: 'a\\r\\nb', y: '\\x05! \\x1f \\x12' }"
    );
});
