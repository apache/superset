var copy = require('../');
var test = require('tape');

test('object', function (t) {
    t.plan(2);
    
    var obj = { a: 3, b: 4, c: [5,6] };
    var dup = copy(obj);
    dup.b *= 111;
    dup.c.push(7);
    
    t.deepEqual(obj, { a: 3, b: 4, c: [ 5, 6, 7 ] });
    t.deepEqual(dup, { a: 3, b: 444, c: [ 5, 6, 7 ] });
});
