// Fractions

// load math.js (using node.js)
var math = require('../index');

// configure the default type of numbers as Fractions
math.config({
  number: 'Fraction'   // Default type of number:
                       // 'number' (default), 'BigNumber', or 'Fraction'
});

console.log('basic usage');
printRatio(math.fraction(0.125));         // Fraction, 1/8
printRatio(math.fraction(0.32));          // Fraction, 8/25
printRatio(math.fraction('1/3'));         // Fraction, 1/3
printRatio(math.fraction('0.(3)'));       // Fraction, 1/3
printRatio(math.fraction(2, 3));          // Fraction, 2/3
printRatio(math.fraction('0.(285714)'));  // Fraction, 2/7
console.log();

console.log('round-off errors with numbers');
print(math.add(0.1, 0.2));                // number, 0.30000000000000004
print(math.divide(0.3, 0.2));             // number, 1.4999999999999998
console.log();

console.log('no round-off errors with fractions :)');
print(math.add(math.fraction(0.1), math.fraction(0.2)));     // Fraction, 3/10
print(math.divide(math.fraction(0.3), math.fraction(0.2)));  // Fraction, 3/2
console.log();

console.log('represent an infinite number of repeating digits');
print(math.fraction('1/3'));        // Fraction, 0.(3)
print(math.fraction('2/7'));        // Fraction, 0.(285714)
print(math.fraction('23/11'));      // Fraction, 2.(09)
console.log();

// one can work conveniently with fractions using the expression parser.
// note though that Fractions are only supported by basic arithmetic functions
console.log('use fractions in the expression parser');
printRatio(math.eval('0.1 + 0.2')); // Fraction,  3/10
printRatio(math.eval('0.3 / 0.2')); // Fraction,  3/2
printRatio(math.eval('23 / 11'));   // Fraction, 23/11
console.log();

// output formatting
console.log('output formatting of fractions');
var a = math.fraction('2/3');
console.log(math.format(a));                          // Fraction,  2/3
console.log(math.format(a, {fraction: 'ratio'}));     // Fraction,  2/3
console.log(math.format(a, {fraction: 'decimal'}));   // Fraction,  0.(6)
console.log(a.toString());                            // Fraction,  0.(6)
console.log();


/**
 * Helper function to output a value in the console.
 * Fractions will be formatted as ratio, like '1/3'.
 * @param {*} value
 */
function printRatio (value) {
  console.log(math.format(value, {fraction: 'ratio'}));
}

/**
 * Helper function to output a value in the console.
 * Fractions will be formatted as decimal, like '0.(3)'.
 * @param {*} value
 */
function print (value) {
  console.log(math.format(value, {fraction: 'decimal'}));
}
