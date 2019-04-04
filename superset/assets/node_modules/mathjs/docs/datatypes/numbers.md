# Numbers

Math.js supports three types of numbers:

- Number for fast floating point arithmetic, described on this page.
- BigNumber for arbitrary precision arithmetic, described on the page
  [BigNumbers](bignumbers.md).
- Fraction, which stores numbers in terms of a numerator and denominators, 
  described on the page [Fractions](fractions.md).


## Configuration

Most functions can determine the type of output from the type of input:
a number as input will return a number as output, a BigNumber as input returns
a BigNumber as output. Functions which cannot determine the type of output
from the input (for example `math.eval`) use the default number type, which
can be configured when instantiating math.js:

```js
math.config({
  number: 'number' // Default type of number: 
                   // 'number' (default), 'BigNumber', or 'Fraction'
});
```

## Round-off errors

Math.js uses the built-in JavaScript Number type. A Number is a floating point
number with a limited precision of 64 bits, about 16 digits. The largest integer
number which can be represented by a JavaScript Number
is `+/- 9007199254740992` (`+/- 2^53`). Because of the limited precision of
floating point numbers round-off errors can occur during calculations.
This can be easily demonstrated:

```js
// a round-off error
0.1 + 0.2;            // 0.30000000000000004
math.add(0.1, 0.2);   // 0.30000000000000004
```

In most cases, round-off errors don't matter: they have no significant
impact on the results. However, it looks ugly when displaying output to a user.
A solution is to limit the precision just below the actual precision of 16
digits in the displayed output:

```js
// prevent round-off errors showing up in output
var ans = math.add(0.1, 0.2);       //  0.30000000000000004
math.format(ans, {precision: 14});  // '0.3'
```

Alternatives are to use [Fractions](fractions.md) which store a number as a numerator and denominator, or [BigNumbers](bignumbers.md), which store a number with a higher precision.


## Minimum and maximum

A Number can store values between `5e-324` and `1.7976931348623157e+308`.
Values smaller than the minimum are stored as `0`, and values larger than the
maximum are stored as `+/- Infinity`.

```js
// exceeding the maximum and minimum number
console.log(1e309);   // Infinity
console.log(1e-324);  // 0
```

## Equality

Because of rounding errors in calculations, it is unsafe to compare JavaScript
Numbers. For example executing `0.1 + 0.2 == 0.3` in JavaScript will return
false, as the addition `0.1 + 0.2` introduces a round-off error and does not
return exactly `0.3`.

To solve this problem, the relational functions of math.js check whether the
relative difference between the compared values is smaller than the configured
option `epsilon`. In pseudo code (without exceptions for 0, Infinity and NaN):

    diff = abs(x - y)
    nearlyEqual = (diff <= max(abs(x), abs(y)) * EPSILON) OR (diff < DBL_EPSILON)

where:

 - `EPSILON` is the relative difference between x and y. Epsilon is configurable
   and is `1e-14` by default. See [Configuration](../core/configuration.md).
 - `DBL_EPSILON` is the minimum positive floating point number such that
   `1.0 + DBL_EPSILON != 1.0`. This is a constant with a value of approximately
   `2.2204460492503130808472633361816e-16`;

Note that the relational functions cannot be used to compare small values
(`< 2.22e-16`). These values are all considered equal to zero.

Examples:

```js
// compare values having a round-off error
console.log(0.1 + 0.2 == 0.3);            // false
console.log(math.equal(0.1 + 0.2, 0.3));  // true

// small values (< 2.22e-16) cannot be compared
console.log(3e-20 == 3.1e-20);            // false
console.log(math.equal(3e-20, 3.1e-20));  // true
```

The available relational functions are: `compare`, `equal`, `larger`,
`largerEq`, `smaller`, `smallerEq`, `unequal`.
