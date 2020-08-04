# Complex Numbers

Math.js supports the creation, manipulation, and calculations with complex numbers.
Support of complex numbers is powered by the library [complex.js](https://github.com/infusion/Complex.js).

In mathematics, a complex number is an expression of the form `a + bi`,
where `a` and `b` are real numbers and `i` represents the imaginary number
defined as `i^2 = -1`. (In other words, `i` is the square root of `-1`.)
The real number `a` is called the real part of the complex number,
and the real number `b` is the imaginary part. For example, `3 + 2i` is a
complex number, having real part `3` and imaginary part `2`.
Complex numbers are often used in applied mathematics, control theory,
signal analysis, fluid dynamics and other fields.

## Usage

A complex number is created using the function `math.complex`. This function
accepts:

- two numbers representing the real and imaginary part of the value,
- a single string containing a complex value in the form `a + bi` where `a`
  and `b` respectively represent the real and imaginary part of the complex number.
- an object with either properties `re` and `im` for the real and imaginary
  part of the value, or two properties `r` and `phi` containing the polar
  coordinates of a complex value.
The function returns a `Complex` object.

Syntax:

```js
math.complex(re: number) : Complex
math.complex(re: number, im: number) : Complex
math.complex(complex: Complex) : Complex
math.complex({re: Number, im: Number}) : Complex
math.complex({r: number, phi: number}) : Complex
math.complex(str: string) : Complex
```

Examples:

```js
var a = math.complex(2, 3);     // Complex 2 + 3i
a.re;                           // Number 2
a.im;                           // Number 3

var b = math.complex('4 - 2i'); // Complex 4 - 2i
b.re = 5;                       // Number 5
b;                              // Complex 5 - 2i
```

## Calculations

Most functions of math.js support complex numbers. Complex and real numbers
can be used together.

```js
var a = math.complex(2, 3);     // Complex 2 + 3i
var b = math.complex('4 - 2i'); // Complex 4 - 2i

math.re(a);                     // Number 2
math.im(a);                     // Number 3
math.conj(a);                   // Complex 2 - 3i

math.add(a, b);                 // Complex 6 + i
math.multiply(a, 2);            // Complex 4 + 6i
math.sqrt(-4);                  // Complex 2i
```

## API
A `Complex` object contains the following properties and functions:

### complex.re

A number containing the real part of the complex number. Can be read and replaced.

### complex.im

A number containing the imaginary part of the complex number. Can be read and replaced.

### complex.clone()

Create a clone of the complex number.

### complex.equals(other)

Test whether a complex number equals another complex value.

  Two complex numbers are equal when both their real and imaginary parts are
  equal.
  
### complex.format([precision: number])

Get a string representation of the complex number,
  formatted as `a + bi` where `a` is the real part and `b` the imaginary part.
  If precision is defined, the units value will be rounded to the provided
  number of digits.
  
### complex.fromJSON(json)

Revive a complex number from a JSON object. Accepts
  An object `{mathjs: 'Complex', re: number, im: number}`, where the property
  `mathjs` is optional.
  Used when deserializing a complex number, see [Serialization](../core/serialization.md).

### complex.fromPolar(r: number, phi: number)

Create a complex number from polar coordinates.

### complex.toJSON()

Returns a JSON representation of the complex number, with signature
  `{mathjs: 'Complex', re: number, im: number}`.
  Used when serializing a complex number, see [Serialization](../core/serialization.md).

### complex.toPolar()

Get the polar coordinates of the complex number, returns
  an object with properties `r` and `phi`.

### complex.toString()

Returns a string representation of the complex number, formatted
  as `a + bi` where `a` is the real part and `b` the imaginary part.

### complex.compare(a: Complex, b: Complex)

Returns the comparision result of two complex number:

- Returns 1 when the real part of `a` is larger than the real part of `b`
- Returns -1 when the real part of `a` is smaller than the real part of `b`
- Returns 1 when the real parts are equal
  and the imaginary part of `a` is larger than the imaginary part of `b`
- Returns -1 when the real parts are equal
  and the imaginary part of `a` is smaller than the imaginary part of `b`
- Returns 0 when both real and imaginary parts are equal.
