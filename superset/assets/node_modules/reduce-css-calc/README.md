# reduce-css-calc [![Build Status](https://travis-ci.org/MoOx/reduce-css-calc.png)](https://travis-ci.org/MoOx/reduce-css-calc)

> Reduce CSS calc() function to the maximum.

Particularly useful for packages like [rework-calc](https://github.com/reworkcss/rework-calc) or [postcss-calc](https://github.com/postcss/postcss-calc).

## Installation

```console
$ npm install reduce-css-calc
```

## Usage

### `var reducedString = reduceCSSCalc(string, precision)`

```javascript
var reduceCSSCalc = require('reduce-css-calc')

reduceCSSCalc("calc(1 + 1)")
// 2

reduceCSSCalc("calc((6 / 2) - (4 * 2) + 1)")
// -4

reduceCSSCalc("calc(1/3)")
// 0.33333

reduceCSSCalc("calc(1/3)", 10)
// 0.3333333333

reduceCSSCalc("calc(3rem * 2 - 1rem)")
// 5rem

reduceCSSCalc("calc(2 * 50%)")
// 100%

reduceCSSCalc("calc(120% * 50%)")
// 60%

reduceCSSCalc("a calc(1 + 1) b calc(1 - 1) c")
// a 2 b 0 c

reduceCSSCalc("calc(calc(calc(1rem * 0.75) * 1.5) - 1rem)")
// 0.125rem

reduceCSSCalc("calc(calc(calc(1rem * 0.75) * 1.5) - 1px)")
// calc(1.125rem - 1px)

reduceCSSCalc("-moz-calc(100px / 2)")
// 50px

reduceCSSCalc("-moz-calc(50% - 2em)")
// -moz-calc(50% - 2em)
```

See [unit tests](test/index.js) for others examples.

## Contributing

Work on a branch, install dev-dependencies, respect coding style & run tests before submitting a bug fix or a feature.

```console
$ git clone https://github.com/MoOx/reduce-css-calc.git
$ git checkout -b patch-1
$ npm install
$ npm test
```

## [Changelog](CHANGELOG.md)

## [License](LICENSE-MIT)
