var evaluate = require('../');
var parse = require('esprima').parse;

var src = '[1,2,3+4*10+n,foo(3+5),obj[""+"x"].y]';
var ast = parse(src).body[0].expression;

console.log(evaluate(ast, {
    n: 6,
    foo: function (x) { return x * 100 },
    obj: { x: { y: 555 } }
}));
