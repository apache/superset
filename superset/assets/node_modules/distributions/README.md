# distributions

> A collection of probability distribution functions

## Installation

```sheel
npm install distributions
```

## Example

```javascript
var distributions = require('distributions');
var normal = distributions.Normal(1 /* mean */, 2 /* std deviation */);

console.log(normal.pdf(1)); // 0.199...
console.log(normal.cdf(1)); // 0.5
console.log(normal.inv(1)); // Infiniy

console.log(normal.mean()); // 1
console.log(normal.median()); // 1
console.log(normal.variance()); // 4
```

## Documentation

All distributions in this module takes some or no arguments and can have a
default value. They are also created by calling the constructor:

```javascript
// both do the same
var uniform = distributions.Uniform(-2, 2);
var uniform = new distributions.Uniform(-2, 2);
```

The instance then has 3 probability functions:

```javascript
var y = uniform.pdf(x); // probability density function
var p = uniform.cdf(q); // cumulative distribution function
var q = uniform.inv(p); // quantile function
```

and also 3 general methods for the _median_, _mean_ and _variance_:

```javascript
uniform.median();
uniform.mean();
uniform.variance();
```

The currently implemented distributions are listed bellow.

##### `Uniform(a = 0, b = 1)` - The Uniform Distribution

Create a uniform distribution, with a range from `a` to `b`. Note that
`uniform.inv(p)` will return `NaN` outside the range from `0` to `1`,
and that `uniform.inv(0) == a` and  `uniform.inv(1) == b`.

##### `Normal(mean = 0, sd = 1)` - The Normal Distribution

Create a normal distribution, with a custom mean (`mean`) and standard deviation
(`sd`).

##### `Studentt(df)` - The Student t Distribution

Create a student t distribution, with a degree of freedom set to `df`.

##### `Binomial(properbility, size)` - The Binomial Distribution

Create a binomial distribution, with a a given `properbility` of success and
sample `size`.

## Testing

All functions are tested by comparing with a mathematical reference
either _MatLab_, _Maple_ or _R_.

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
