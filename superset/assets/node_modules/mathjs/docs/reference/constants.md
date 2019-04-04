# Constant reference

Math.js contains the following constants. 

Constant        | Description | Value
--------------- | ----------- | -----
`e`, `E`        | Euler's number, the base of the natural logarithm. | 2.718281828459045
`i`             | Imaginary unit, defined as i*i=-1. A complex number is described as a + b*i, where a is the real part, and b is the imaginary part. | `sqrt(-1)`
`Infinity`      | Infinity, a number which is larger than the maximum number that can be handled by a floating point number. | `Infinity`
`LN2`           | Returns the natural logarithm of 2. | `0.6931471805599453`
`LN10`          | Returns the natural logarithm of 10. | `2.302585092994046`
`LOG2E`         | Returns the base-2 logarithm of E. | `1.4426950408889634`
`LOG10E`        | Returns the base-10 logarithm of E. | `0.4342944819032518`
`NaN`           | Not a number. | `NaN`
`null`          | Value null. | `null`
`phi`           | Phi is the golden ratio. Two quantities are in the golden ratio if their ratio is the same as the ratio of their sum to the larger of the two quantities. Phi is defined as `(1 + sqrt(5)) / 2` | `1.618033988749895`
`pi`, `PI`      | The number pi is a mathematical constant that is the ratio of a circle\'s circumference to its diameter. | `3.141592653589793`
`SQRT1_2`       | Returns the square root of 1/2. | `0.7071067811865476`
`SQRT2`         | Returns the square root of 2. | `1.4142135623730951`
`tau`           | Tau is the ratio constant of a circle\'s circumference to radius, equal to `2 * pi`. | `6.283185307179586`
`uninitialized` | Constant used as default value when resizing a matrix to leave new entries uninitialized.
`version`       | Returns the version number of math.js. | For example `0.24.1`

Example usage:

```js
math.sin(math.pi / 4);          // 0.70711
math.multiply(math.i, math.i);  // -1
```
