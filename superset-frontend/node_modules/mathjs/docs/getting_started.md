# Getting Started

This getting started describes how to install, load, and use math.js.


## Install

Math.js can be installed using various package managers like [npm](https://npmjs.org/) and [bower](http://bower.io/), or by just downloading the library from the website: [http://mathjs.org/download.html](http://mathjs.org/download.html).

To install via npm, run:

    npm install mathjs

Other ways to install math.js are described on the [website](http://mathjs.org/download.html).


## Load

Math.js can be used in node.js and in the browser. The library must be loaded
and instantiated. When creating an instance, one can optionally provide
configuration options as described in
[Configuration](configuration.md).

### Node.js

Load math.js in [node.js](http://nodejs.org/):

```js
// load math.js
var math = require('mathjs');

// use math.js
math.sqrt(-4); // 2i
```


### Browser

Math.js can be loaded as a regular JavaScript file in the browser, use the global
variable `math` to access the libary once loaded:

```html
<!DOCTYPE HTML>
<html>
<head>
  <script src="math.js" type="text/javascript"></script>
</head>
<body>
  <script type="text/javascript">
    // use the math.js libary
    math.sqrt(-4); // 2i
  </script>
</body>
</html>
```

If support for old browsers (Internet Explorer 8 and older) is required,
the [es5-shim](https://github.com/kriskowal/es5-shim) library must be loaded
as well.


### Require.js

Load math.js in the browser using [require.js](http://requirejs.org/):

```js
require.config({
  paths: {
    mathjs: 'path/to/mathjs',
  }
});
require(['mathjs'], function (math) {
  // use math.js
  math.sqrt(-4); // 2i
});
```

## Use

Math.js can be used similar to JavaScript's built-in Math library. Besides that,
math.js can evaluate expressions (see [Expressions](expressions/index.md)) and
supports chaining (see [Chaining](chaining.md)).

The example code below shows how to use math.js. More examples can be found in the
section [Examples](http://mathjs.org/examples/index.html).

```js
// functions and constants
math.round(math.e, 3);            // 2.718
math.atan2(3, -3) / math.pi;      // 0.75
math.log(10000, 10);              // 4
math.sqrt(-4);                    // 2i
math.pow([[-1, 2], [3, 1]], 2);   // [[7, 0], [0, 7]]

// expressions
math.eval('12 / (2.3 + 0.7)');    // 4
math.eval('12.7 cm to inch');     // 5 inch
math.eval('sin(45 deg) ^ 2');     // 0.5
math.eval('9 / 3 + 2i');          // 3 + 2i
math.eval('det([-1, 2; 3, 1])');  // -7

// chained operations
math.chain(3)
    .add(4)
    .multiply(2)
    .done(); // 14
```

## Next

To learn more about math.js, check out the available documentation and examples:

- [Documentation](index.md)
- [Examples](http://mathjs.org/examples/index.html)
