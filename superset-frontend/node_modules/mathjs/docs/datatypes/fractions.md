# Fractions

For calculations with fractions, math.js supports a `Fraction` data type. 
Fraction support is powered by [fraction.js](https://github.com/infusion/Fraction.js).
Unlike [numbers](numbers.md) and [BigNumbers](./bignumbers.md), fractions can 
store numbers with infinitely repeating decimals, for example `1/3 = 0.3333333...`, 
which can be represented as `0.(3)`, or `2/7` which can be represented as `0.(285714)`.


## Usage

A Fraction can be created using the function `fraction`:

```js
math.fraction('1/3');   // Fraction, 1/3
math.fraction(2, 3);    // Fraction, 2/3
math.fraction('0.(3)'); // Fraction, 1/3
```

And can be used in functions like `add` and `multiply` like:

```js
math.add(math.fraction('1/3'), math.fraction('1/6'));      // Fraction, 1/2
math.multiply(math.fraction('1/4'), math.fraction('1/2')); // Fraction, 1/8
```

Note that not all functions support fractions. For example trigonometric 
functions doesn't support fractions. When not supported, the functions
will convert the input to numbers and return a number as result.

Most functions will determine the type of output from the type of input:
a number as input will return a number as output, a Fraction as input returns
a Fraction as output. Functions which cannot determine the type of output
from the input (for example `math.eval`) use the default number type `number`,
which can be configured when instantiating math.js. To configure the use of
fractions instead of [numbers](numbers.md) by default, configure math.js like:

```js
// Configure the default type of number: 'number' (default), 'BigNumber', or 'Fraction'
math.config({
  number: 'Fraction'
});

// use the expression parser
math.eval('0.32 + 0.08');   // Fraction, 2/5
```

## Support

The following functions support fractions:

- Arithmetic functions: `abs`, `add`, `ceil`, `cube`, `divide`, `dotDivide`, `dotMultiply`, `fix`, `floor`, `gcd`, `mod`, `multiply`, `round`, `sign`, `square`, `subtract`, `unaryMinus`, `unaryPlus`.
- Construction functions: `fraction`.
- Relational functions: `compare`, `deepEqual`, `equal`, `larger`, `largerEq`, `smaller`, `smallerEq`, `unequal`.
- Utils functions: `format`.


## Conversion

Fractions can be converted to numbers and vice versa using the functions
`number` and `fraction`. When converting a Fraction to a number, precision
may be lost when the value cannot represented in 16 digits. 

```js
// converting numbers and fractions
var a = math.number(0.3);                         // number, 0.3
var b = math.fraction(a);                         // Fraction, 3/10
var c = math.number(b);                           // number, 0.3

// loosing precision when converting to number: a fraction can represent
// a number with an infinite number of repeating decimals, a number just
// stores about 16 digits and cuts consecutive digits.
var d = math.fraction('2/5');                     // Fraction, 2/5
var e = math.number(d);                           // number, 0.4
```
