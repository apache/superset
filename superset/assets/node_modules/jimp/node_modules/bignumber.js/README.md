![bignumber.js](https://raw.githubusercontent.com/MikeMcl/bignumber.js/gh-pages/bignumberjs.png)

A JavaScript library for arbitrary-precision decimal and non-decimal arithmetic.

[![Build Status](https://travis-ci.org/MikeMcl/bignumber.js.svg)](https://travis-ci.org/MikeMcl/bignumber.js)

<br />

## Features

  - Faster, smaller, and perhaps easier to use than JavaScript versions of Java's BigDecimal
  - 8 KB minified and gzipped
  - Simple API but full-featured
  - Works with numbers with or without fraction digits in bases from 2 to 64 inclusive
  - Replicates the `toExponential`, `toFixed`, `toPrecision` and `toString` methods of JavaScript's Number type
  - Includes a `toFraction` and a correctly-rounded `squareRoot` method
  - Supports cryptographically-secure pseudo-random number generation
  - No dependencies
  - Wide platform compatibility: uses JavaScript 1.5 (ECMAScript 3) features only
  - Comprehensive [documentation](http://mikemcl.github.io/bignumber.js/) and test set

![API](https://raw.githubusercontent.com/MikeMcl/bignumber.js/gh-pages/API.png)

If a smaller and simpler library is required see [big.js](https://github.com/MikeMcl/big.js/).
It's less than half the size but only works with decimal numbers and only has half the methods.
It also does not allow `NaN` or `Infinity`, or have the configuration options of this library.

See also [decimal.js](https://github.com/MikeMcl/decimal.js/), which among other things adds support for non-integer powers, and performs all operations to a specified number of significant digits.

## Load

The library is the single JavaScript file *bignumber.js* (or minified, *bignumber.min.js*).

```html
<script src='relative/path/to/bignumber.js'></script>
```

For [Node.js](http://nodejs.org), the library is available from the [npm](https://npmjs.org/) registry

    $ npm install bignumber.js

```javascript
var BigNumber = require('bignumber.js');
```

To load with AMD loader libraries such as [requireJS](http://requirejs.org/):

```javascript
require(['path/to/bignumber'], function(BigNumber) {
    // Use BigNumber here in local scope. No global BigNumber.
});
```

## Use

*In all examples below, `var`, semicolons and `toString` calls are not shown.
If a commented-out value is in quotes it means `toString` has been called on the preceding expression.*

The library exports a single function: `BigNumber`, the constructor of BigNumber instances.

It accepts a value of type number *(up to 15 significant digits only)*, string or BigNumber object,

```javascript
x = new BigNumber(123.4567)
y = BigNumber('123456.7e-3')
z = new BigNumber(x)
x.equals(y) && y.equals(z) && x.equals(z)      // true
```


and a base from 2 to 64 inclusive can be specified.

```javascript
x = new BigNumber(1011, 2)          // "11"
y = new BigNumber('zz.9', 36)       // "1295.25"
z = x.plus(y)                       // "1306.25"
```

A BigNumber is immutable in the sense that it is not changed by its methods.

```javascript
0.3 - 0.1                           // 0.19999999999999998
x = new BigNumber(0.3)
x.minus(0.1)                        // "0.2"
x                                   // "0.3"
```

The methods that return a BigNumber can be chained.

```javascript
x.dividedBy(y).plus(z).times(9).floor()
x.times('1.23456780123456789e+9').plus(9876.5432321).dividedBy('4444562598.111772').ceil()
```

Many method names have a shorter alias.

```javascript
x.squareRoot().dividedBy(y).toPower(3).equals(x.sqrt().div(y).pow(3))         // true
x.cmp(y.mod(z).neg()) == 1 && x.comparedTo(y.modulo(z).negated()) == 1        // true
```

Like JavaScript's number type, there are `toExponential`, `toFixed` and `toPrecision` methods

```javascript
x = new BigNumber(255.5)
x.toExponential(5)                  // "2.55500e+2"
x.toFixed(5)                        // "255.50000"
x.toPrecision(5)                    // "255.50"
x.toNumber()                        // 255.5
```

 and a base can be specified for `toString`.

 ```javascript
 x.toString(16)                     // "ff.8"
 ```

There is also a `toFormat` method which may be useful for internationalisation

```javascript
y = new BigNumber('1234567.898765')
y.toFormat(2)                       // "1,234,567.90"
```

The maximum number of decimal places of the result of an operation involving division (i.e. a division, square root, base conversion or negative power operation) is set using the `config` method of the `BigNumber` constructor.

The other arithmetic operations always give the exact result.

```javascript
BigNumber.config({ DECIMAL_PLACES: 10, ROUNDING_MODE: 4 })
// Alternatively, BigNumber.config( 10, 4 );

x = new BigNumber(2);
y = new BigNumber(3);
z = x.div(y)                        // "0.6666666667"
z.sqrt()                            // "0.8164965809"
z.pow(-3)                           // "3.3749999995"
z.toString(2)                       // "0.1010101011"
z.times(z)                          // "0.44444444448888888889"
z.times(z).round(10)                // "0.4444444445"
```

There is a `toFraction` method with an optional *maximum denominator* argument

```javascript
y = new BigNumber(355)
pi = y.dividedBy(113)               // "3.1415929204"
pi.toFraction()                     // [ "7853982301", "2500000000" ]
pi.toFraction(1000)                 // [ "355", "113" ]
```

and `isNaN` and `isFinite` methods, as `NaN` and `Infinity` are valid `BigNumber` values.

```javascript
x = new BigNumber(NaN)                                           // "NaN"
y = new BigNumber(Infinity)                                      // "Infinity"
x.isNaN() && !y.isNaN() && !x.isFinite() && !y.isFinite()        // true
```

The value of a BigNumber is stored in a decimal floating point format in terms of a coefficient, exponent and sign.


```javascript
x = new BigNumber(-123.456);
x.c                                 // [ 123, 45600000000000 ]  coefficient (i.e. significand)
x.e                                 // 2                        exponent
x.s                                 // -1                       sign
```


Multiple BigNumber constructors can be created, each with their own independent configuration which applies to all BigNumber's created from it.

```javascript
// Set DECIMAL_PLACES for the original BigNumber constructor
BigNumber.config({ DECIMAL_PLACES: 10 })

// Create another BigNumber constructor, optionally passing in a configuration object
BN = BigNumber.another({ DECIMAL_PLACES: 5 })

x = new BigNumber(1)
y = new BN(1)

x.div(3)                            // '0.3333333333'
y.div(3)                            // '0.33333'
```

For futher information see the [API](http://mikemcl.github.io/bignumber.js/) reference in the *doc* directory.

## Test

The *test* directory contains the test scripts for each method.

The tests can be run with Node or a browser. For Node use

    $ npm test

or

    $ node test/every-test

To test a single method, e.g.

    $ node test/toFraction

For the browser, see *every-test.html* and *single-test.html* in the *test/browser* directory.

*bignumber-vs-number.html* enables some of the methods of bignumber.js to be compared with those of JavaScript's number type.

## Versions

This is version 2.x.x of the library, for version 1.x.x see the tagged releases or switch to the 'original' branch. The advantages of version 2 are that it is considerably faster for numbers with many digits and that there are a some added methods (see Change Log below). The disadvantages are more lines of code and increased code complexity, and the loss of simplicity in no longer having the coefficient of a BigNumber stored in base 10. The 'original' version will continue to be supported.

## Performance

See the [README](https://github.com/MikeMcl/bignumber.js/tree/master/perf) in the *perf* directory.

## Build

For Node, if [uglify-js](https://github.com/mishoo/UglifyJS2) is installed

    npm install uglify-js -g

then

    npm run build

will create *bignumber.min.js*.

A source map will also be created in the root directory.

## Feedback

Open an issue, or email

Michael

<a href="mailto:M8ch88l@gmail.com">M8ch88l@gmail.com</a>

## Licence

MIT.

See [LICENCE](https://github.com/MikeMcl/bignumber.js/blob/master/LICENCE).

## Change Log

####2.4.0
* 14/07/2016
* #97 Add exports to support ES6 imports.

####2.3.0
* 07/03/2016
* #86 Add modulus parameter to `toPower`.

####2.2.0
* 03/03/2016
* #91 Permit larger JS integers.

####2.1.4
* 15/12/2015
* Correct UMD.

####2.1.3
* 13/12/2015
* Refactor re global object and crypto availability when bundling.

####2.1.2
* 10/12/2015
* Bugfix: `window.crypto` not assigned to `crypto`.

####2.1.1
* 09/12/2015
* Prevent code bundler from adding `crypto` shim.

####2.1.0
* 26/10/2015
* For `valueOf` and `toJSON`, include the minus sign with negative zero.

####2.0.8
* 2/10/2015
* Internal round function bugfix.

####2.0.6
* 31/03/2015
* Add bower.json. Tweak division after in-depth review.

####2.0.5
* 25/03/2015
* Amend README. Remove bitcoin address.

####2.0.4
* 25/03/2015
* Critical bugfix #58: division.

####2.0.3
* 18/02/2015
* Amend README. Add source map.

####2.0.2
* 18/02/2015
* Correct links.

####2.0.1
* 18/02/2015
* Add `max`, `min`, `precision`, `random`, `shift`, `toDigits` and `truncated` methods.
* Add the short-forms: `add`, `mul`, `sd`, `sub` and `trunc`.
* Add an `another` method to enable multiple independent constructors to be created.
* Add support for the base 2, 8 and 16 prefixes `0b`, `0o` and `0x`.
* Enable a rounding mode to be specified as a second parameter to `toExponential`, `toFixed`, `toFormat` and `toPrecision`.
* Add a `CRYPTO` configuration property so cryptographically-secure pseudo-random number generation can be specified.
* Add a `MODULO_MODE` configuration property to enable the rounding mode used by the `modulo` operation to be specified.
* Add a `POW_PRECISION` configuration property to enable the number of significant digits calculated by the power operation to be limited.
* Improve code quality.
* Improve documentation.

####2.0.0
* 29/12/2014
* Add `dividedToIntegerBy`, `isInteger` and `toFormat` methods.
* Remove the following short-forms: `isF`, `isZ`, `toE`, `toF`, `toFr`, `toN`, `toP`, `toS`.
* Store a BigNumber's coefficient in base 1e14, rather than base 10.
* Add fast path for integers to BigNumber constructor.
* Incorporate the library into the online documentation.

####1.5.0
* 13/11/2014
* Add `toJSON` and `decimalPlaces` methods.

####1.4.1
* 08/06/2014
* Amend README.

####1.4.0
* 08/05/2014
* Add `toNumber`.

####1.3.0
* 08/11/2013
* Ensure correct rounding of `sqrt` in all, rather than almost all, cases.
* Maximum radix to 64.

####1.2.1
* 17/10/2013
* Sign of zero when x < 0 and x + (-x) = 0.

####1.2.0
* 19/9/2013
* Throw Error objects for stack.

####1.1.1
* 22/8/2013
* Show original value in constructor error message.

####1.1.0
* 1/8/2013
* Allow numbers with trailing radix point.

####1.0.1
* Bugfix: error messages with incorrect method name

####1.0.0
* 8/11/2012
* Initial release
