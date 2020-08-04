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

test('array methods invocation count', function(t) {
    t.plan(2);

    var variables = {
        values: [1, 2, 3],
        receiver: []
    };
    var src = 'values.forEach(function(x) { receiver.push(x); })'
    var ast = parse(src).body[0].expression;
    evaluate(ast, variables);
    t.equal(variables.receiver.length, 3);
    t.deepEqual(variables.receiver, [1, 2, 3]);
})

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

test('disallow accessing constructor or __proto__', function (t) {
    t.plan(4)

    var someValue = {};

    var src = 'object.constructor';
    var ast = parse(src).body[0].expression;
    var res = evaluate(ast, { vars: { object: someValue } });
    t.equal(res, undefined);

    var src = 'object["constructor"]';
    var ast = parse(src).body[0].expression;
    var res = evaluate(ast, { vars: { object: someValue } });
    t.equal(res, undefined);

    var src = 'object.__proto__';
    var ast = parse(src).body[0].expression;
    var res = evaluate(ast, { vars: { object: someValue } });
    t.equal(res, undefined);

    var src = 'object["__pro"+"t\x6f__"]';
    var ast = parse(src).body[0].expression;
    var res = evaluate(ast, { vars: { object: someValue } });
    t.equal(res, undefined);
});


test('constructor at runtime only', function(t) {
    t.plan(2)

    var src = '(function myTag(y){return ""[!y?"__proto__":"constructor"][y]})("constructor")("console.log(process.env)")()'
    var ast = parse(src).body[0].expression;
    var res = evaluate(ast);
    t.equal(res, undefined);

    var src = '(function(prop) { return {}[prop ? "benign" : "constructor"][prop] })("constructor")("alert(1)")()'
    var ast = parse(src).body[0].expression;
    var res = evaluate(ast);
    t.equal(res, undefined);
});

test('short circuit evaluation AND', function(t) {
    t.plan(1);

    var variables = {
        value: null
    };
    var src = 'value && value.func()';
    var ast = parse(src).body[0].expression;
    var res = evaluate(ast, variables);
    t.equals(res, null);
})

test('short circuit evaluation OR', function(t) {
    t.plan(1);

    var fnInvoked = false;
    var variables = {
        value: true,
        fn: function() { fnInvoked = true}
    };
    var src = 'value || fn()';
    var ast = parse(src).body[0].expression;
    evaluate(ast, variables);
    t.equals(fnInvoked, false);
})

test('function declaration does not invoke CallExpressions', function(t) {
    t.plan(1);

    var invoked = false;
    var variables = {
        noop: function(){},
        onInvoke: function() {invoked = true}
    };
    var src = 'noop(function(){ onInvoke(); })';
    var ast = parse(src).body[0].expression;
    evaluate(ast, variables);
    t.equal(invoked, false);
});