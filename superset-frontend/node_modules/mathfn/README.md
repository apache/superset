# mathfn

> Some basic but difficult to implement mathmatical functions<br>
> _Note: for distribution functions please see [`distributions`](https://github.com/AndreasMadsen/distributions)_

## Installation

```sheel
npm install mathfn
```

## Example

```javascript
var mathfn = require('mathfn');

console.log(mathfn.erf(0)); // 0.0
```

## Documentation

`mathfn` is a slowly growing collection of some difficult mathmatical functions
there should be included in `Math.` but isn't. This is a list of the currently
implemented functions and a few details.

### Error functions

##### `p = erf(x)` - The error function

This function is implemented using the "Abramowitz & Stegun" approximation
its theortical accuracy is `1.5 * 10^-7`. However the limitations of JavaScript
might result in a lower accuracy.

##### `p = erfc(x)` The complementary error function

Unlike most implementation of `erfc(x)`, this is not calculated using `1 - erf(x)`,
but is an acutall approximation of `erfc(x)`.

##### `p = invErf(p)` The inverse error function

This is calculated using `inverf(p) = -inverfc(p + 1)`, if you known of specific
approximation please file an issue or pull request.

##### `p = invErfc(p)` The inverse complementary error function

This uses a very common approximation of `inverfc(p)`, see source code for more
details.

### Gamma functions

##### `p = gamma(x)` The gamma function

This acutally contains 3 diffrent approximations of `gamma(x)` which one is
automatically determined by the `x` value.

##### `p = logGamma(x)` The logarithmic gamma function

For values less than `12` the result is calculated using `log(gamma(x))`, in
any other case a specific approximation is used.

### Beta functions

These are taken from the `jstat` library and modified to fit intro the API
pattern used in this module. Futhermore they also take advanges of the special
`log1p` function implemented in this module.

##### `p = beta(x, y)` - The beta function

##### `p = logBeta(x, y)` - The logarithmic beta function

##### `p = incBeta(x, a, b)` - The incomplete beta function

##### `p = invIncBeta(p, a, b)` - The inverse incomplete beta function

### Logarithmic functions

##### `y = log1p(x)` - Calculates `y = ln(1 + x)`

When `x` is a very small number computers calculates `ln(1 + x)` as `ln(1)` which
is `zero` and then every thing is lost. This is a specific approximation of
`ln(1 + x)` and should be used only in case of small values.

##### `y = logFactorial(x)` - Calculates `y = ln(x!)`

`x!` can quickly get very big, and exceed the limitation of the float value,
approimating `ln(x!)` instead can in some cases solve this problem.

## Testing

All functions are tested by comparing with a mathematical reference
either _MatLab_, _Maple_ or _R_.

## Thanks

A special thank to John D. Cook, who writes a very good blog about some of these
functions, and maintains a [stand alone implementation catalog](http://www.johndcook.com/stand_alone_code.html).
See also this article about regarding floating point errors in some mathematical
function: http://www.johndcook.com/blog/2010/06/07/math-library-functions-that-seem-unnecessary/

## License

**The software is license under "MIT"**

> Copyright (c) 2013 Andreas Madsen
>
> Permission is hereby granted, free of charge, to any person obtaining a copy
> of this software and associated documentation files (the "Software"), to deal
> in the Software without restriction, including without limitation the rights
> to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
> copies of the Software, and to permit persons to whom the Software is
> furnished to do so, subject to the following conditions:
>
> The above copyright notice and this permission notice shall be included in
> all copies or substantial portions of the Software.
>
> THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
> IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
> FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
> AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
> LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
> OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
> THE SOFTWARE.
