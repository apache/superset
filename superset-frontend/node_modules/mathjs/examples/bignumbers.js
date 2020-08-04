// BigNumbers

// load math.js (using node.js)
var math = require('../index');

// configure the default type of numbers as BigNumbers
math.config({
  number: 'BigNumber',  // Default type of number:
                        // 'number' (default), 'BigNumber', or 'Fraction'
  precision: 20         // Number of significant digits for BigNumbers
});

console.log('round-off errors with numbers');
print(math.add(0.1, 0.2));    // number, 0.30000000000000004
print(math.divide(0.3, 0.2)); // number, 1.4999999999999998
console.log();

console.log('no round-off errors with BigNumbers');
print(math.add(math.bignumber(0.1), math.bignumber(0.2)));     // BigNumber, 0.3
print(math.divide(math.bignumber(0.3), math.bignumber(0.2)));  // BigNumber, 1.5
console.log();

console.log('create BigNumbers from strings when exceeding the range of a number');
print(math.bignumber(1.2e+500));    // BigNumber, Infinity      WRONG
print(math.bignumber('1.2e+500'));  // BigNumber, 1.2e+500
console.log();

// one can work conveniently with BigNumbers using the expression parser.
// note though that BigNumbers are only supported in arithmetic functions
console.log('use BigNumbers in the expression parser');
print(math.eval('0.1 + 0.2'));  // BigNumber, 0.3
print(math.eval('0.3 / 0.2'));  // BigNumber, 1.5
console.log();


/**
 * Helper function to output a value in the console. Value will be formatted.
 * @param {*} value
 */
function print (value) {
  console.log(math.format(value));
}
