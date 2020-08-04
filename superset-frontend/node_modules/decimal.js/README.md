![decimal.js](https://raw.githubusercontent.com/MikeMcl/decimal.js/gh-pages/decimaljs.png)

An arbitrary-precision Decimal type for JavaScript.

[![Build Status](https://travis-ci.org/MikeMcl/decimal.js.svg)](https://travis-ci.org/MikeMcl/decimal.js)
[![CDNJS](https://img.shields.io/cdnjs/v/decimal.js.svg)](https://cdnjs.com/libraries/decimal.js)

<br>

## Features

  - Integers and floats
  - Simple but full-featured API
  - Replicates many of the methods of JavaScript's `Number.prototype` and `Math` objects
  - Also handles hexadecimal, binary and octal values
  - Faster, smaller, and perhaps easier to use than JavaScript versions of Java's BigDecimal
  - No dependencies
  - Wide platform compatibility: uses JavaScript 1.5 (ECMAScript 3) features only
  - Comprehensive [documentation](http://mikemcl.github.io/decimal.js/) and test set
  - Includes a TypeScript declaration file: *decimal.d.ts*

![API](https://raw.githubusercontent.com/MikeMcl/decimal.js/gh-pages/API.png)

The library is similar to [bignumber.js](https://github.com/MikeMcl/bignumber.js/), but here
precision is specified in terms of significant digits rather than decimal places, and all
calculations are rounded to the precision (similar to Python's decimal module) rather than just
those involving division.

This library also adds the trigonometric functions, among others, and supports non-integer powers,
which makes it a significantly larger library than *bignumber.js* and the even smaller
[big.js](https://github.com/MikeMcl/big.js/).

For a lighter version of this library without the trigonometric functions see [decimal.js-light](https://github.com/MikeMcl/decimal.js-light/).

## Load

The library is the single JavaScript file *decimal.js* (or minified, *decimal.min.js*).

Browser:

```html
<script src='path/to/decimal.js'></script>
```

[Node.js](http://nodejs.org):

```bash
$ npm install --save decimal.js
```

```js
var Decimal = require('decimal.js');
```

ES6 module (*decimal.mjs*):

```js
//import Decimal from 'decimal.js';
import {Decimal} from 'decimal.js';
```

AMD loader libraries such as [requireJS](http://requirejs.org/):

```js
require(['decimal'], function(Decimal) {
    // Use Decimal here in local scope. No global Decimal.
});
```

## Use

*In all examples below, `var`, semicolons and `toString` calls are not shown.
If a commented-out value is in quotes it means `toString` has been called on the preceding expression.*

The library exports a single function object, `Decimal`, the constructor of Decimal instances.

It accepts a value of type number, string or Decimal.

```js
x = new Decimal(123.4567)
y = new Decimal('123456.7e-3')
z = new Decimal(x)
x.equals(y) && y.equals(z) && x.equals(z)        // true
```

A value can also be in binary, hexadecimal or octal if the appropriate prefix is included.

```js
x = new Decimal('0xff.f')            // '255.9375'
y = new Decimal('0b10101100')        // '172'
z = x.plus(y)                        // '427.9375'

z.toBinary()                         // '0b110101011.1111'
z.toBinary(13)                       // '0b1.101010111111p+8'
```

Using binary exponential notation to create a Decimal with the value of `Number.MAX_VALUE`:

```js
x = new Decimal('0b1.1111111111111111111111111111111111111111111111111111p+1023')
```

A Decimal is immutable in the sense that it is not changed by its methods.

```js
0.3 - 0.1                     // 0.19999999999999998
x = new Decimal(0.3)
x.minus(0.1)                  // '0.2'
x                             // '0.3'
```

The methods that return a Decimal can be chained.

```js
x.dividedBy(y).plus(z).times(9).floor()
x.times('1.23456780123456789e+9').plus(9876.5432321).dividedBy('4444562598.111772').ceil()
```

Many method names have a shorter alias.

```js
x.squareRoot().dividedBy(y).toPower(3).equals(x.sqrt().div(y).pow(3))         // true
x.cmp(y.mod(z).neg()) == 1 && x.comparedTo(y.modulo(z).negated()) == 1        // true
```

Like JavaScript's Number type, there are `toExponential`, `toFixed` and `toPrecision` methods,

```js
x = new Decimal(255.5)
x.toExponential(5)              // '2.55500e+2'
x.toFixed(5)                    // '255.50000'
x.toPrecision(5)                // '255.50'
```

and almost all of the methods of JavaScript's Math object are also replicated.

```js
Decimal.sqrt('6.98372465832e+9823')      // '8.3568682281821340204e+4911'
Decimal.pow(2, 0.0979843)                // '1.0702770511687781839'
```

There are `isNaN` and `isFinite` methods, as `NaN` and `Infinity` are valid `Decimal` values,

```js
x = new Decimal(NaN)                                           // 'NaN'
y = new Decimal(Infinity)                                      // 'Infinity'
x.isNaN() && !y.isNaN() && !x.isFinite() && !y.isFinite()      // true
```

and a `toFraction` method with an optional *maximum denominator* argument

```js
z = new Decimal(355)
pi = z.dividedBy(113)        // '3.1415929204'
pi.toFraction()              // [ '7853982301', '2500000000' ]
pi.toFraction(1000)          // [ '355', '113' ]
```

All calculations are rounded according to the number of significant digits and rounding mode
specified by the `precision` and `rounding` properties of the Decimal constructor.

Multiple Decimal constructors can be created, each with their own independent configuration which
applies to all Decimal numbers created from it.

```js
// Set the precision and rounding of the default Decimal constructor
Decimal.set({ precision: 5, rounding: 4 })

// Create another Decimal constructor, optionally passing in a configuration object
Decimal9 = Decimal.clone({ precision: 9, rounding: 1 })

x = new Decimal(5)
y = new Decimal9(5)

x.div(3)                           // '1.6667'
y.div(3)                           // '1.66666666'
```

The value of a Decimal is stored in a floating point format in terms of its digits, exponent and sign.

```js
x = new Decimal(-12345.67);
x.d                            // [ 12345, 6700000 ]    digits (base 10000000)
x.e                            // 4                     exponent (base 10)
x.s                            // -1                    sign
```

For further information see the [API](http://mikemcl.github.io/decimal.js/) reference in the *doc* directory.

## Test

The library can be tested using Node.js or a browser.

The *test* directory contains the file *test.js* which runs all the tests when executed by Node,
and the file *test.html* which runs all the tests when opened in a browser.

To run all the tests, from a command-line at the root directory using npm

```bash
$ npm test
```

or at the *test* directory using Node

```bash
$ node test
```

Each separate test module can also be executed individually, for example, at the *test/modules* directory

```bash
$ node toFraction
```

## Build

For Node, if [uglify-js](https://github.com/mishoo/UglifyJS2) is installed

```bash
npm install uglify-js -g
```

then

```bash
npm run build
```

will create *decimal.min.js*, and a source map will also be added to the *doc* directory.

## Licence

MIT.

See *LICENCE.md*
