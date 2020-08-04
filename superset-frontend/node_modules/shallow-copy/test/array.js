var copy = require('../');
var test = require('tape');

test('array', function (t) {
    t.plan(2);
    
    var xs = [ 3, 4, 5, { f: 6, g: 7 } ];
    var dup = copy(xs);
    dup.unshift(1, 2);
    dup[5].g += 100;
    
    t.deepEqual(xs, [ 3, 4, 5, { f: 6, g: 107 } ]);
    t.deepEqual(dup, [ 1, 2, 3, 4, 5, { f: 6, g: 107 } ]);
});
