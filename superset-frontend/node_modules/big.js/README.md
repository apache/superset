
# big.js #

A small, fast JavaScript library for arbitrary-precision decimal arithmetic.

The little sister to [bignumber.js](https://github.com/MikeMcl/bignumber.js/).
See also [decimal.js](https://github.com/MikeMcl/decimal.js/), and [here](https://github.com/MikeMcl/big.js/wiki) for the difference between them.

## Features

  - Faster, smaller and easier-to-use than JavaScript versions of Java's BigDecimal
  - Only 2.7 KB minified and gzipped
  - Simple API
  - Replicates the `toExponential`, `toFixed` and `toPrecision` methods of JavaScript's Number type
  - Includes a `sqrt` method
  - Stores values in an accessible decimal floating point format
  - No dependencies
  - Comprehensive [documentation](http://mikemcl.github.io/big.js/) and test set

## Load

The library is the single JavaScript file *big.js* (or *big.min.js*, which is *big.js* minified).

It can be loaded via a script tag in an HTML document for the browser

    <script src='./relative/path/to/big.js'></script>

or as a CommonJS, [Node.js](http://nodejs.org) or AMD module using `require`.

    var Big = require('big.js');

For Node.js, the library is available from the npm registry:

    $ npm install big.js



## Use

*In all examples below, `var`, semicolons and `toString` calls are not shown.
If a commented-out value is in quotes it means `toString` has been called on the preceding expression.*

The library exports a single function: Big, the constructor of Big number instances.
It accepts a value of type Number, String or Big number Object.

    x = new Big(123.4567)
    y = Big('123456.7e-3')             // 'new' is optional
    z = new Big(x)
    x.eq(y) && x.eq(z) && y.eq(z)      // true

A Big number is immutable in the sense that it is not changed by its methods.

    0.3 - 0.1                          // 0.19999999999999998
    x = new Big(0.3)
    x.minus(0.1)                       // "0.2"
    x                                  // "0.3"

The methods that return a Big number can be chained.

    x.div(y).plus(z).times(9).minus('1.234567801234567e+8').plus(976.54321).div('2598.11772')
    x.sqrt().div(y).pow(3).gt(y.mod(z))    // true

Like JavaScript's Number type, there are `toExponential`, `toFixed` and `toPrecision` methods.

    x = new Big(255.5)
    x.toExponential(5)                 // "2.55500e+2"
    x.toFixed(5)                       // "255.50000"
    x.toPrecision(5)                   // "255.50"

The maximum number of decimal places and the rounding mode used to round the results of the `div`, `sqrt` and `pow`
(with negative exponent) methods is determined by the value of the `DP` and `RM` properties of the `Big` number constructor.  

The other methods always give the exact result.  

(From *v3.0.0*, multiple Big number constructors can be created, see Change Log below.)

    Big.DP = 10
    Big.RM = 1

    x = new Big(2);
    y = new Big(3);
    z = x.div(y)                       // "0.6666666667"
    z.sqrt()                           // "0.8164965809"
    z.pow(-3)                          // "3.3749999995"
    z.times(z)                         // "0.44444444448888888889"
    z.times(z).round(10)               // "0.4444444445"


The value of a Big number is stored in a decimal floating point format in terms of a coefficient, exponent and sign.

    x = new Big(-123.456);
    x.c                                // [1,2,3,4,5,6]    coefficient (i.e. significand)
    x.e                                // 2                exponent
    x.s                                // -1               sign

For further information see the [API](http://mikemcl.github.io/big.js/) reference from the *doc* folder.

## Test

The *test* directory contains the test scripts for each Big number method.

The tests can be run with Node or a browser.

To test a single method, from a command-line shell at the *test* directory, use e.g.

    $ node toFixed

To test all the methods

    $ node every-test

For the browser, see *single-test.html* and *every-test.html* in the *test/browser* directory.

*big-vs-number.html* enables some of the methods of big.js to be compared with those of JavaScript's Number type.

## Performance

The *perf* directory contains two applications and a *lib* directory containing the BigDecimal libraries used by both.

*big-vs-bigdecimal.html* tests the performance of big.js against the JavaScript translations of two versions of BigDecimal, its use should be more or less self-explanatory.
(The GWT version doesn't work in IE 6.)

* GWT: java.math.BigDecimal
<https://github.com/iriscouch/bigdecimal.js>
* ICU4J: com.ibm.icu.math.BigDecimal
<https://github.com/dtrebbien/BigDecimal.js>

The BigDecimal in Node's npm registry is the GWT version. Despite its seeming popularity I have found it to have some serious bugs, see the Node script *perf/lib/bigdecimal_GWT/bugs.js* for examples of flaws in its *remainder*, *divide* and *compareTo* methods.

*bigtime.js* is a Node command-line application which tests the performance of big.js against the GWT version of
BigDecimal from the npm registry.

For example, to compare the time taken by the big.js `plus` method and the BigDecimal `add` method:

    $ node bigtime plus 10000 40

This will time 10000 calls to each, using operands of up to 40 random digits and will check that the results match.

For help:

    $ node bigtime -h

## Build

I.e. minify.

For Node, if uglify-js is installed globally ( `npm install uglify-js -g` ) then

    uglifyjs -o ./big.min.js ./big.js

will create *big.min.js*.

The *big.min.js* already present was created with *Microsoft Ajax Minifier 5.11*.

## TypeScript

The [DefinitelyTyped](https://github.com/borisyankov/DefinitelyTyped) project has a TypeScript [definitions file](https://github.com/borisyankov/DefinitelyTyped/blob/master/big.js/big.js.d.ts) for big.js.

The definitions file can be added to your project via the [big.js.TypeScript.DefinitelyTyped](https://www.nuget.org/packages/big.js.TypeScript.DefinitelyTyped/0.0.1) NuGet package or via [tsd](http://definitelytyped.org/tsd/).

    tsd query big.js --action install

Any questions about the TypeScript definitions file should be addressed to the DefinitelyTyped project.

## Feedback

Feedback is welcome.

Bugs/comments/questions?
Open an issue, or email

Michael
<a href="mailto:M8ch88l@gmail.com">M8ch88l@gmail.com</a>

Bitcoin donation to:
**1DppGRQSjVSMgGxuygDEHQuWEdTiVEzJYG**
Thank you

## Licence

See LICENCE.

## Change Log

####3.2.0

* 14/09/17 Aid ES6 import.

####3.1.3

* Minor documentation updates.

####3.1.2

* README typo.

####3.1.1

* API documentation update, including FAQ additions.

####3.1.0

* Renamed and exposed `TO_EXP_NEG` and `TO_EXP_POS` as `Big.E_NEG` and
 `Big.E_POS`.

####3.0.2

* Remove *.npmignore*, use `files` field in *package.json* instead.

####3.0.1

* Added `sub`, `add` and `mul` aliases.
* Clean-up after lint.

####3.0.0

* 10/12/14 Added [multiple constructor functionality](http://mikemcl.github.io/big.js/#faq).
* No breaking changes or other additions, but a major code reorganisation,
 so *v3* seemed appropriate.

####2.5.2

* 1/11/14 Added bower.json.

####2.5.1

* 8/06/14 Amend README requires.

####2.5.0

* 26/01/14 Added `toJSON` method so serialization uses `toString`.

####2.4.1

* 17/10/13 Conform signed zero to IEEEE 754 (2008).

####2.4.0

* 19/09/13 Throw instances of `Error`.

####2.3.0

* 16/09/13 Added `cmp` method.

####2.2.0

* 11/07/13 Added 'round up' mode.

####2.1.0

* 26/06/13 Allow e.g. `.1` and `2.`.

####2.0.0

* 12/05/13 Added `abs` method and replaced `cmp` with `eq`, `gt`, `gte`, `lt`, and `lte` methods.

####1.0.1

* Changed default value of MAX_DP to 1E6

####1.0.0

* 7/11/2012 Initial release
