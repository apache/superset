# Extension

The library can easily be extended with functions and variables using the
[`import`](../reference/functions/import.md) function. The function `import`
accepts an object with functions and variables.

Function `import` has the following syntax:

```js
math.import(object: Object [, options: Object])
```

Where:

- `object` is an object or array containing the functions and/or values to be
  imported. `import` support regular values and functions, typed functions
  (see section [Typed functions](#typed-functions)), and factory functions
  (see section [Factory functions](#factory-functions)).
  An array is only applicable when it contains factory functions.

- `options` is an optional second argument with options.
  The following options are available:

    - `{boolean} override`
      If `true`, existing functions will be overwritten. The default value is `false`.
    - `{boolean} silent`
      If `true`, the function will not throw errors on duplicates or invalid
      types. Default value is `false`.
    - `{boolean} wrap`
      If `true`, the functions will be wrapped in a wrapper function which
      converts data types like Matrix to primitive data types like Array.
      The wrapper is needed when extending math.js with libraries which do not
      support the math.js data types. The default value is `false`.

The following code example shows how to import a function and a value into math.js:

```js
// define new functions and variables
math.import({
  myvalue: 42,
  hello: function (name) {
    return 'hello, ' + name + '!';
  }
});

// defined functions can be used in both JavaScript as well as the parser
math.myvalue * 2;               // 84
math.hello('user');             // 'hello, user!'

var parser = math.parser();
parser.eval('myvalue + 10');    // 52
parser.eval('hello("user")');   // 'hello, user!'
```

## Import external libraries

External libraries like
[numbers.js](https://github.com/sjkaliski/numbers.js) and
[numeric.js](http://numericjs.com/) can be imported as follows.
The libraries must be installed using npm:

    $ npm install numbers
    $ npm install numeric

The libraries can be easily imported into math.js using `import`.
In order to convert math.js specific data types like `Matrix` to primitive types
like `Array`, the imported functions can be wrapped by enabling `{wrap: true}`.

```js
// import the numbers.js and numeric.js libraries into math.js
math.import(require('numbers'), {wrap: true, silent: true});
math.import(require('numeric'), {wrap: true, silent: true});

// use functions from numbers.js
math.fibonacci(7);                          // 13
math.eval('fibonacci(7)');                  // 13

// use functions from numeric.js
math.eval('eig([1, 2; 4, 3])').lambda.x;    // [5, -1]
```


## Typed functions

Typed functions can be created using `math.typed`. A typed function is a function
which does type checking on the input arguments. It can have multiple signatures.
And can automatically convert input types where needed.

A typed function can be created like:

```js
var max = typed('max', {
  'number, number': function (a, b) {
    return Math.max(a, b);
  },

  'BigNumber, BigNumber': function (a, b) {
    return a.greaterThan(b) ? a : b;
  }
});
```

Typed functions can be merged as long as there are no conflicts in the signatures.
This allows for extending existing functions in math.js with support for new
data types.

```js
// create a new data type
function MyType (value) {
  this.value = value;
}
MyType.prototype.isMyType = true;
MyType.prototype.toString = function () {
  return 'MyType:' + this.value;
}

// define a new datatype
math.typed.addType({
  name: 'MyType',
  test: function (x) {
    // test whether x is of type MyType
    return x && x.isMyType;
  }
})

// use the type in a new typed function
var add = typed('add', {
  'MyType, MyType': function (a, b) {
    return new MyType(a.value + b.value);
  }
});

// import in math.js, extend the existing function `add` with support for MyType
math.import({add: add});

// use the new type
var ans = math.add(new MyType(2), new MyType(3)); // returns MyType(5)
console.log(ans);                                 // outputs 'MyType:5'
```

Detailed information on typed functions is available here:
[https://github.com/josdejong/typed-function](https://github.com/josdejong/typed-function)




## Factory functions

Regular JavaScript functions can be imported in math.js using `math.import`:

```js
math.import({
  myFunction: function (a, b) {
     // ...
  }
});
```

The function can be stored in a separate file:

```js
exports.myFunction = function (a, b) {
  // ...
}
```

Which can be imported like:

```js
math.import(require('./myFunction.js'));
```

An issue arises when `myFunction` needs functionality from math.js:
it doesn't have access to the current instance of math.js when in a separate file.
Factory functions can be used to solve this issue. A file exporting a factory function
looks like:

```js
exports.name = 'myFunction';
exports.factory = function (type, config, load, typed) {
  return myFunction (a, b) {
    // ...
  }
};
```

The file exports a name and a factory function. When running `math.import`, the factory
function is invoked by math.js with four arguments:

-   `type: Object`: Object containing the data types of math.js,
    like `type.BigNumber` and `type.Unit`.
-   `config: Object`: object with the configuration of math.js.
-   `load: function`: loader function to access functions from math.js. For example to
    load the function `add`:

    ```js
    exports.factory = function (type, config, load, typed) {
      var add = load(require('mathjs/lib/function/arithmetic/add'));

      return myFunction (a, b) {
        // ...
      }
    };
    ```

-   `typed: function`:  function to create typed-functions.

The result returned by a factory function will be imported into the `math`
namespace under the given `name`, `math.myFunction` in the above example.

A factory can contain the following properties:

- `name: string`. The name of the exported function or value. Required.
- `factory: function (type, config, load, typed) `. The factory function,
  must return the function or value to be imported in math.js. Required.
- `path: string`. An optional path to where the function or value will be
  imported. By default, imported functions have no path and are imported in
  the 'flat' namespace `math`. Data types have `type` as path, and will be
  located under `math.type.*`. Optional.
- `lazy: boolean`. If true (default), the factory function will be lazy loaded:
  it is executed as soon as the function is about to be used.
- `math: boolean`. False by default. If true, the `math` namespace is passed
  to the factory function as fifth argument. Should not be used unless there
  is a very good reason for it.

To import a set of factory functions, the function `math.import` accepts an
array containing factory functions:

```js
math.import([
  require('./myFactoryFunction1.js'),
  require('./myFactoryFunction2.js'),
  require('./myFactoryFunction3.js'),
  // ...
]);
```
