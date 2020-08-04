# BigNumbers

For calculations with an arbitrary precision, math.js supports a `BigNumber`
datatype. BigNumber support is powered by
[decimal.js](https://github.com/MikeMcl/decimal.js/).

## Usage

A BigNumber can be created using the function `bignumber`:

```js
math.bignumber('2.3e+500'); // BigNumber, 2.3e+500
```

Most functions can determine the type of output from the type of input:
a number as input will return a number as output, a BigNumber as input returns
a BigNumber as output. Functions which cannot determine the type of output
from the input (for example `math.eval`) use the default number type `number`,
which can be configured when instantiating math.js. To configure the use of
BigNumbers instead of [numbers](numbers.md) by default, configure math.js like:

```js
math.config({
  number: 'BigNumber', // Default type of number:
                       // 'number' (default), 'BigNumber', or 'Fraction'
  precision: 64        // Number of significant digits for BigNumbers
});

// use math
math.eval('0.1 + 0.2'); // BigNumber, 0.3
```

The default precision for BigNumber is 64 digits, and can be configured with
the option `precision`.


## Support

Most functions in math.js support BigNumbers, but not all of them.
For example the function `random` doesn't support BigNumbers.


## Round-off errors

Calculations with BigNumber are much slower than calculations with Number,
but they can be executed with an arbitrary precision. By using a higher
precision, it is less likely that round-off errors occur:

```js
// round-off errors with numbers
math.add(0.1, 0.2);                                     // Number, 0.30000000000000004
math.divide(0.3, 0.2);                                  // Number, 1.4999999999999998

// no round-off errors with BigNumbers :)
math.add(math.bignumber(0.1), math.bignumber(0.2));     // BigNumber, 0.3
math.divide(math.bignumber(0.3), math.bignumber(0.2));  // BigNumber, 1.5
```


## Limitations

It's important to realize that BigNumbers do not solve *all* problems related
to precision and round-off errors. Numbers with an infinite number of digits
cannot be represented with a regular number nor a BigNumber. Though a BigNumber
can store a much larger number of digits, the amount of digits remains limited
if only to keep calculations fast enough to remain practical.

```js
var one = math.bignumber(1);
var three = math.bignumber(3);
var third = math.divide(one, three);
console.log(third.toString());
// outputs 0.3333333333333333333333333333333333333333333333333333333333333333

var ans = math.multiply(third, three);
console.log(ans.toString());
// outputs 0.9999999999999999999999999999999999999999999999999999999999999999
// this should be 1 again, but `third` is rounded to a limited number of digits 3
```


## Conversion

BigNumbers can be converted to numbers and vice versa using the functions
`number` and `bignumber`. When converting a BigNumber to a number, the high
precision of the BigNumber will be lost. When a BigNumber is too large to be represented
as Number, it will be initialized as `Infinity`.

```js
// converting numbers and BigNumbers
var a = math.number(0.3);                         // number, 0.3
var b = math.bignumber(a);                        // BigNumber, 0.3
var c = math.number(b);                           // number, 0.3

// exceeding the maximum of a number
var d = math.bignumber('1.2e500');                // BigNumber, 1.2e+500
var e = math.number(d);                           // number, Infinity

// loosing precision when converting to number
var f = math.bignumber('0.2222222222222222222');  // BigNumber, 0.2222222222222222222
var g = math.number(f);                           // number,    0.2222222222222222
```
