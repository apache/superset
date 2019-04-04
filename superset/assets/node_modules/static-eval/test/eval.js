var test = require('tape');
var evaluate = require('../');
var parse = require('esprima').parse;

test('resolved', function (t) {
    t.plan(1);
    
    var src = '[1,2,3+4*10+(n||6),foo(3+5),obj[""+"x"].y]';
    var ast = parse(src).body[0].expression;
    var res = evaluate(ast, {
        n: false,
        foo: function (x) { return x * 100 },
        obj: { x: { y: 555 } }
    });
    t.deepEqual(res, [ 1, 2, 49, 800, 555 ]);
});

test('unresolved', function (t) {
    t.plan(1);
    
    var src = '[1,2,3+4*10*z+n,foo(3+5),obj[""+"x"].y]';
    var ast = parse(src).body[0].expression;
    var res = evaluate(ast, {
        n: 6,
        foo: function (x) { return x * 100 },
        obj: { x: { y: 555 } }
    });
    t.equal(res, undefined);
});

test('boolean', function (t) {
    t.plan(1);
    
    var src = '[ 1===2+3-16/4, [2]==2, [2]!==2, [2]!==[2] ]';
    var ast = parse(src).body[0].expression;
    t.deepEqual(evaluate(ast), [ true, true, true, true ]);
});

test('array methods', function(t) {
    t.plan(1);

    var src = '[1, 2, 3].map(function(n) { return n * 2 })';
    var ast = parse(src).body[0].expression;
    t.deepEqual(evaluate(ast), [2, 4, 6]);
});

test('array methods with vars', function(t) {
    t.plan(1);

    var src = '[1, 2, 3].map(function(n) { return n * x })';
    var ast = parse(src).body[0].expression;
    t.deepEqual(evaluate(ast, {x: 2}), [2, 4, 6]);
});

test('evaluate this', function(t) {
    t.plan(1);

    var src = 'this.x + this.y.z';
    var ast = parse(src).body[0].expression;
    var res = evaluate(ast, {
        'this': { x: 1, y: { z: 100 } }
    });
    t.equal(res, 101);
});

test('FunctionExpression unresolved', function(t) {
    t.plan(1);

    var src = '(function(){console.log("Not Good")})';
    var ast = parse(src).body[0].expression;
    var res = evaluate(ast, {});
    t.equal(res, undefined);
});

test('MemberExpressions from Functions unresolved', function(t) {
    t.plan(1);

    var src = '(function () {}).constructor';
    var ast = parse(src).body[0].expression;
    var res = evaluate(ast, {});
    t.equal(res, undefined);
});