var inspect = require('../');
var test = require('tape');

test('circular', function (t) {
    t.plan(1);
    var obj = { a: 1, b: [3, 4] };
    obj.c = obj;
    t.equal(inspect(obj), '{ a: 1, b: [ 3, 4 ], c: [Circular] }');
});
