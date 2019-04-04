// algebra
//
// math.js has support for symbolic computation (CAS). It can parse
// expressions in an expression tree and do algebraic operations like
// simplification and derivation on this tree.

// load math.js (using node.js)
var math = require('../index');

// simplify an expression
console.log('simplify expressions');
console.log(math.simplify('3 + 2 / 4').toString());             // '7 / 2'
console.log(math.simplify('2x + 3x').toString());               // '5 * x'
console.log(math.simplify('2 * 3 * x', {x: 4}).toString());     // '24'
console.log(math.simplify('x^2 + x + 3 + x^2').toString());     // '2 * x ^ 2 + x + 3'
console.log(math.simplify('x * y * -x / (x ^ 2)').toString());  // '-y'

// work with an expression tree, evaluate results
var f = math.parse('2x + x');
var simplified = math.simplify(f);
console.log(simplified.toString());    // '3 * x'
console.log(simplified.eval({x: 4}));  // 12
console.log()

// calculate a derivative
console.log('calculate derivatives');
console.log(math.derivative('2x^2 + 3x + 4', 'x').toString());  // '4 * x + 3'
console.log(math.derivative('sin(2x)', 'x').toString());        // '2 * cos(2 * x)'

// work with an expression tree, evaluate results
var h = math.parse('x^2 + x');
var dh = math.derivative(h, 'x');
console.log(dh.toString());       // '2 * x + 1'
console.log(dh.eval({x: 3}));     // '7'
