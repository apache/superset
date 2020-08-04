# Complex.js - ℂ in JavaSript

[![NPM Package](https://nodei.co/npm-dl/complex.js.png?months=6&height=1)](https://npmjs.org/package/complex.js)

[![Build Status](https://travis-ci.org/infusion/Complex.js.svg?branch=master)](https://travis-ci.org/infusion/Complex.js)
[![MIT license](http://img.shields.io/badge/license-MIT-brightgreen.svg)](http://opensource.org/licenses/MIT)

Complex.js is a well tested JavaScript library to work with complex number arithmetic in JavaScript. It implements every elementary complex number manipulation function and the API is intentionally similar to [Fraction.js](https://github.com/infusion/Fraction.js). Furthermore, it's the basis of [Polynomial.js](https://github.com/infusion/Polynomial.js) and [Math.js](https://github.com/josdejong/mathjs).


Example
===

```js
var Complex = require('complex.js');

var c = new Complex("99.3+8i");
c.mul({re: 3, im: 9}).div(4.9).sub(3, 2);
```

Parser
===

Any function (see below) as well as the constructor of the *Complex* class parses its input like this.

You can pass either Objects, Doubles or Strings.

Objects
---
```javascript
new Complex({re: real, im: imaginary});
new Complex({arg: angle, abs: radius});
new Complex({phi: angle, r: radius});
new Complex([real, imaginary]); // Vector/Array syntax
```
If there are other attributes on the passed object, they're not getting preserved and have to be merged manually.

Doubles
---
```javascript
new Complex(55.4);
```

Strings
---
```javascript
new Complex("123.45");
new Complex("15+3i");
new Complex("i");
```

Two arguments
---
```javascript
new Complex(3, 2); // 3+2i
```

Functions
===

Complex sign()
---
Returns the complex sign, defined as the complex number normalized by it's absolute value

Complex add(n)
---
Adds another complex number

Complex sub(n)
---
Subtracts another complex number

Complex mul(n)
---
Multiplies the number with another complex number

Complex div(n)
---
Divides the number by another complex number

Complex pow(exp)
---
Returns the number raised to the complex exponent

Complex sqrt()
---
Returns the complex square root of the number

Complex exp(n)
---
Returns `e^n` with complex exponent `n`.

Complex log()
---
Returns the natural logarithm (base `E`) of the actual complex number

_Note:_ The logarithm to a different base can be calculated with `z.log().div(Math.log(base))`.

double abs()
---
Calculates the magnitude of the complex number

double arg()
---
Calculates the angle of the complex number

Complex inverse()
---
Calculates the multiplicative inverse of the complex number (1 / z)

Complex conjugate()
---
Calculates the conjugate of the complex number (multiplies the imaginary part with -1)

Complex neg()
---
Negates the number (multiplies both the real and imaginary part with -1) in order to get the additive inverse

Complex floor([places=0])
---
Floors the complex number parts towards zero

Complex ceil([places=0])
---
Ceils the complex number parts off zero

Complex round([places=0])
---
Rounds the complex number parts

boolean equals(n)
---
Checks if both numbers are exactly the same

boolean isNaN()
---
Checks if the given number is not a number

boolean isFinite()
---
Checks if the given number is finite

Complex clone()
---
Returns a new Complex instance with the same real and imaginary properties

Array toVector()
---
Returns a Vector of the actual complex number with two components

String toString()
---
Returns a string representation of the actual number. As of v1.9.0 the output is a bit more human readable

```javascript
new Complex(1, 2).toString(); // 1 + 2i
new Complex(0, 1).toString(); // i
new Complex(9, 0).toString(); // 9
new Complex(1, 1).toString(); // 1 + i
```

double valueOf()
---
Returns the real part of the number if imaginary part is zero. Otherwise `null`


Trigonometric functions
===
The following trigonometric functions are defined on Complex.js:

| Trig | Arcus | Hyperbolic | Arcus-Hyperbolic |
|------|-------|------------|------------------|
| sin()  | asin()  | sinh()       | asinh()            |
| cos()  | acos()  | cosh()       | acosh()            |
| tan()  | atan()  | tanh()       | atanh()            |
| cot()  | acot()  | coth()       | acoth()            |
| sec()  | asec()  | sech()       | asech()            |
| csc()  | acsc()  | csch()       | acsch()            |


Geometric Equivalence
===

Complex numbers can also be seen as a vector in the 2D space. Here is a simple overview of basic operations and how to implement them with complex.js:

New vector
---
```js
var v1 = new Complex(1, 0);
var v2 = new Complex(1, 1);
```

Scale vector
---
```js
scale(v1, factor):= v1.mul(factor)
```

Vector norm
---
```js
norm(v):= v.abs()
```

Translate vector
---
```js
translate(v1, v2):= v1.add(v2)
```

Rotate vector around center
---
```js
rotate(v, angle):= v.mul({abs: 1, arg: angle})
```

Rotate vector around a point
---
```js
rotate(v, p, angle):= v.sub(p).mul({abs: 1, arg: angle}).add(p)
```

Distance to another vector
---
```js
distance(v1, v2):= v1.sub(v2).abs()
```

Constants
===

Complex.ZERO
---
A complex zero instance

Complex.ONE
---
A complex one instance

Complex.I
---
An imaginary number i instance

Complex.PI
---
A complex PI instance

Complex.E
---
A complex euler number instance

Complex.EPSILON
---
A small epsilon value used for `equals()` comparison in order to circumvent double inprecision.


Installation
===
Installing complex.js is as easy as cloning this repo or use one of the following commands:

```bash
bower install complex.js
```
or

```bash
npm install complex.js
```

Using Complex.js with the browser
===
```html
<script src="complex.js"></script>
<script>
    console.log(Complex("4+3i"));
</script>
```

Using Complex.js with require.js
===
```html
<script src="require.js"></script>
<script>
requirejs(['complex.js'],
function(Complex) {
    console.log(Complex("4+3i"));
});
</script>
```

Coding Style
===
As every library I publish, complex.js is also built to be as small as possible after compressing it with Google Closure Compiler in advanced mode. Thus the coding style orientates a little on maxing-out the compression rate. Please make sure you keep this style if you plan to extend the library.


Testing
===
If you plan to enhance the library, make sure you add test cases and all the previous tests are passing. You can test the library with

```bash
npm test
```


Copyright and licensing
===
Copyright (c) 2015, [Robert Eisele](http://www.xarg.org/)
Dual licensed under the MIT or GPL Version 2 licenses.
