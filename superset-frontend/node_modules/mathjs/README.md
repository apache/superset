![math.js](https://raw.github.com/josdejong/mathjs/master/img/mathjs.png)

[http://mathjs.org](http://mathjs.org)

Math.js is an extensive math library for JavaScript and Node.js. It features a flexible expression parser with support for symbolic computation, comes with a large set of built-in functions and constants, and offers an integrated solution to work with different data types like numbers, big numbers, complex numbers, fractions, units, and matrices. Powerful and easy to use.

[![Version](https://img.shields.io/npm/v/mathjs.svg)](https://www.npmjs.com/package/mathjs)
[![Downloads](https://img.shields.io/npm/dm/mathjs.svg)](https://www.npmjs.com/package/mathjs)
[![Build Status](https://img.shields.io/travis/josdejong/mathjs.svg)](https://travis-ci.org/josdejong/mathjs)
![Maintenance](https://img.shields.io/maintenance/yes/2018.svg)
[![License](https://img.shields.io/github/license/josdejong/mathjs.svg)](https://github.com/josdejong/mathjs/blob/master/LICENSE)
[![FOSSA Status](https://app.fossa.io/api/projects/git%2Bgithub.com%2Fjosdejong%2Fmathjs.svg?type=shield)](https://app.fossa.io/projects/git%2Bgithub.com%2Fjosdejong%2Fmathjs?ref=badge_shield)

## Features

- Supports numbers, big numbers, complex numbers, fractions, units, strings, arrays, and matrices.
- Is compatible with JavaScript's built-in Math library.
- Contains a flexible expression parser.
- Does symbolic computation.
- Comes with a large set of built-in functions and constants.
- Can be used as a command line application as well.
- Runs on any JavaScript engine.
- Is easily extensible.
- Open source.

## Usage

Math.js can be used in both node.js and in the browser.

Install math.js using [npm](https://www.npmjs.com/package/mathjs):

    npm install mathjs

Or download mathjs via one of the CDN's listed on the downloads page: 

&nbsp;&nbsp;&nbsp;&nbsp;[http://mathjs.org/download.html](http://mathjs.org/download.html#download)

Math.js can be used similar to JavaScript's built-in Math library. Besides that,
math.js can evaluate
[expressions](http://mathjs.org/docs/expressions/index.html)
and supports
[chained operations](http://mathjs.org/docs/core/chaining.html).

```js
// load math.js
var math = require('mathjs');

// functions and constants
math.round(math.e, 3);            // 2.718
math.atan2(3, -3) / math.pi;      // 0.75
math.log(10000, 10);              // 4
math.sqrt(-4);                    // 2i
math.pow([[-1, 2], [3, 1]], 2);   // [[7, 0], [0, 7]]
math.derivative('x^2 + x', 'x');  // 2 * x + 1

// expressions
math.eval('12 / (2.3 + 0.7)');    // 4
math.eval('12.7 cm to inch');     // 5 inch
math.eval('sin(45 deg) ^ 2');     // 0.5
math.eval('9 / 3 + 2i');          // 3 + 2i
math.eval('det([-1, 2; 3, 1])');  // -7

// chaining
math.chain(3)
    .add(4)
    .multiply(2)
    .done(); // 14
```

See the [Getting Started](http://mathjs.org/docs/getting_started.html) for a more detailed tutorial. 


## Browser support

Math.js works on any ES5 compatible JavaScript engine: node.js 0.10, and Internet Explorer 9 and newer, and all other browsers (Chrome, Firefox, Safari). If support for old browsers like Internet Explorer 8 is required, the [es5-shim](https://github.com/kriskowal/es5-shim) library has to be loaded.


## Documentation

- [Getting Started](http://mathjs.org/docs/getting_started.html)
- [Examples](http://mathjs.org/examples/index.html)
- [Overview](http://mathjs.org/docs/index.html)
- [History](http://mathjs.org/history.html)


## Build

First clone the project from github:

    git clone git://github.com/josdejong/mathjs.git
    cd mathjs

Install the project dependencies:

    npm install

Then, the project can be build by executing the build script via npm:

    npm run build

This will build the library math.js and math.min.js from the source files and
put them in the folder dist.


## Test

To execute tests for the library, install the project dependencies once:

    npm install

Then, the tests can be executed:

    npm test

To test code coverage of the tests:

    npm run coverage

To see the coverage results, open the generated report in your browser:

    ./coverage/lcov-report/index.html

Automated cross browser testing for mathjs is generously provided by <a href="https://www.browserstack.com" target="_blank">BrowserStack</a>

<a href="https://www.browserstack.com" target="_blank"><img alt="BrowserStack" src="https://raw.github.com/josdejong/mathjs/master/misc/browserstack.png"></a>


## License

Copyright (C) 2013-2018 Jos de Jong <wjosdejong@gmail.com>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

   http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
