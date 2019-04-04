# Custom bundling

Math.js is a large library containing many data types and functions. 
It is well possible that you only need a small portion of the library. 
Math.js allows for creating a custom index file, loading only the data types 
and functions  that you need. This give faster load times, and allows bundling 
only the used part of the library with tools like Webpack or browserify.

To load an empty instance of math.js, load `mathjs/core`. This core only
contains functions `import` and `config`.

```js
// Load the math.js core
var core = require('mathjs/core');

// Create a new, empty math.js instance
// It will only contain methods `import` and `config`
var math = core.create();
```

Then, use `math.import` to load the needed data types and functions. 
It's important to load the data types first, and after that load functions
and constants. The functions are dynamically built, depending on the available
data types.

```js
// load the data types you need. Let's say you just want to use fractions,
// but no matrices, complex numbers, bignumbers, and other stuff.
//
// To load all data types:
//
//     math.import(require('mathjs/lib/type'));
//
math.import(require('mathjs/lib/type/fraction'));

// Load the functions you need.
//
// To load all functions:
//
//     math.import(require('mathjs/lib/function'));
//
// To load all functions of a specific category:
//
//     math.import(require('mathjs/lib/function/arithmetic'));
//
math.import(require('mathjs/lib/function/arithmetic/add'));
math.import(require('mathjs/lib/function/arithmetic/subtract'));
math.import(require('mathjs/lib/function/arithmetic/multiply'));
math.import(require('mathjs/lib/function/arithmetic/divide'));
math.import(require('mathjs/lib/function/string/format'));
```

To see which data types and categories are available, explore the `index.js` 
files in the folder `./lib`.

The imported functions and data types can now be used:

```js
// Use the loaded functions
var a = math.fraction(1, 3);
var b = math.fraction(3, 7);
var c = math.add(a, b);
console.log('result:', math.format(c)); // outputs "result: 16/21"
```

Suppose the custom loading code (loading `mathjs/core` and doing the imports)
is located in a file `custom_loading.js`. It's now possible to bundle
this file using for example browserify:

```bash
$ browserify custom_loading.js -o custom_loading.bundle.js
```
