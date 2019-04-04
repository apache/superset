// chaining

// load math.js (using node.js)
var math = require('../index');

// create a chained operation using the function `chain(value)`
// end a chain using done(). Let's calculate (3 + 4) * 2
var a = math.chain(3)
    .add(4)
    .multiply(2)
    .done();
print(a);  // 14

// Another example, calculate square(sin(pi / 4))
var b = math.chain(math.pi)
    .divide(4)
    .sin()
    .square()
    .done();
print(b);  // 0.5

// A chain has a few special methods: done, toString, valueOf, get, and set.
// these are demonstrated in the following examples

// toString will return a string representation of the chain's value
var chain = math.chain(2).divide(3);
var str = chain.toString();
print(str);  // "0.6666666666666666"

// a chain has a function .valueOf(), which returns the value hold by the chain.
// This allows using it in regular operations. The function valueOf() acts the
// same as function done().
print(chain.valueOf()); // 0.66666666666667
print(chain + 2);       // 2.6666666666667


// the function subset can be used to get or replace sub matrices
var array = [[1, 2], [3, 4]];
var v = math.chain(array)
    .subset(math.index(1, 0))
    .done();
print(v);  // 3

var m = math.chain(array)
    .subset(math.index(0, 0), 8)
    .multiply(3)
    .done();
print(m);  // [[24, 6], [9, 12]]


/**
 * Helper function to output a value in the console. Value will be formatted.
 * @param {*} value
 */
function print (value) {
  var precision = 14;
  console.log(math.format(value, precision));
}
