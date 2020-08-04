var test = require('tape');
var evaluate = require('../');
var parse = require('esprima').parse;

test('function property', function (t) {
    t.plan(1);
    
    var src = '[1,2,3+4*10+n,beep.boop(3+5),obj[""+"x"].y]';
    var ast = parse(src).body[0].expression;
    var res = evaluate(ast, {
        n: 6,
        beep: { boop: function (x) { return x * 100 } },
        obj: { x: { y: 555 } }
    });
    t.deepEqual(res, [ 1, 2, 49, 800, 555 ]);
});
