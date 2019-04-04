# typed-function

Move type checking logic and type conversions outside of your function in a
flexible, organized way. Automatically throw informative errors in case of
wrong input arguments.


## Features

typed-function has the following features:

- Runtime type-checking of input arguments.
- Automatic type conversion of arguments.
- Compose typed functions with multiple signatures.
- Supports union types, any type, and variable arguments.
- Detailed error messaging.

Supported environments: node.js, Chrome, Firefox, Safari, Opera, IE9+.


## Why?

In JavaScript, functions can be called with any number and any type of arguments.
When writing a function, the easiest way is to just assume that the function
will be called with the correct input. This leaves the function's behavior on
invalid input undefined. The function may throw some error, or worse,
it may silently fail or return wrong results. Typical errors are
*TypeError: undefined is not a function* or *TypeError: Cannot call method
'request' of undefined*. These error messages are not very helpful. It can be
hard to debug them, as they can be the result of a series of nested function
calls manipulating and propagating invalid or incomplete data.

Often, JavaScript developers add some basic type checking where it is important,
using checks like `typeof fn === 'function'`, `date instanceof Date`, and
`Array.isArray(arr)`. For functions supporting multiple signatures,
the type checking logic can grow quite a bit, and distract from the actual
logic of the function.

For functions dealing with a considerable amount of type checking and conversion
logic, or functions facing a public API, it can be very useful to use the
`typed-function` module to handle the type-checking logic. This way:

-   Users of the function get useful and consistent error messages when using
    the function wrongly.
-   The function cannot silently fail or silently give wrong results due to
    invalid input.
-   Correct type of input is assured inside the function. The function's code
    becomes easier to understand as it only contains the actual function logic.
    Lower level utility functions called by the type-checked function can
    possibly be kept simpler as they don't need to do additional type checking.

It's important however not to *overuse* type checking:

-   Locking down the type of input that a function accepts can unnecessary limit
    it's flexibility. Keep functions as flexible and forgiving as possible,
    follow the
    [robustness principle](http://en.wikipedia.org/wiki/Robustness_principle)
    here: "be liberal in what you accept and conservative in what you send"
    (Postel's law).
-   There is no need to apply type checking to *all* functions. It may be
    enough to apply type checking to one tier of public facing functions.
-   There is a performance penalty involved for all type checking, so applying
    it everywhere can unnecessarily worsen the performance.


## Load

Install via npm:

    npm install typed-function


## Usage

Here some usage examples. More examples are available in the
[/examples](/examples) folder.

```js
var typed = require('typed-function');

// create a typed function
var fn1 = typed({
  'number, string': function (a, b) {
    return 'a is a number, b is a string';
  }
});

// create a typed function with multiple types per argument (type union)
var fn2 = typed({
  'string, number | boolean': function (a, b) {
    return 'a is a string, b is a number or a boolean';
  }
});

// create a typed function with any type argument
var fn3 = typed({
  'string, any': function (a, b) {
    return 'a is a string, b can be anything';
  }
});

// create a typed function with multiple signatures
var fn4 = typed({
  'number': function (a) {
    return 'a is a number';
  },
  'number, boolean': function (a, b) {
    return 'a is a number, b is a boolean';
  },
  'number, number': function (a, b) {
    return 'a is a number, b is a number';
  }
});

// use the functions
console.log(fn1(2, 'foo'));      // outputs 'a is a number, b is a string'
console.log(fn4(2));             // outputs 'a is a number'

// calling the function with a non-supported type signature will throw an error
try {
  fn2('hello', 'world');
}
catch (err) {
  console.log(err.toString());
  // outputs:  TypeError: Unexpected type of argument.
  //           Expected: number or boolean, actual: string, index: 1.
}
```


## Types

typed-function has the following built-in types:

- `null`
- `boolean`
- `number`
- `string`
- `Function`
- `Array`
- `Date`
- `RegExp`
- `Object`

The following type expressions are supported:

- Multiple arguments: `string, number, Function`
- Union types: `number | string`
- Variable arguments: `...number`
- Any type: `any`


## API

### Construction

A typed function can be constructed in two ways:

-   Create from an object with one or multiple signatures:

    ```
    typed(signatures: Object.<string, function>) : function
    typed(name: string, signatures: Object.<string, function>) : function
    ```

-   Merge multiple typed functions into a new typed function:

    ```
    typed(functions: ...function) : function
    ```


### Methods

-   `typed.convert(value: *, type: string) : *`

    Convert an value to another type. Only applicable when conversions have
    been defined in `typed.conversions` (see section [Properties](#properties)). 
    Example:
    
    ```js
    typed.conversions.push({
      from: 'number',
      to: 'string',
      convert: function (x) {
        return +x;
    });
    
    var str = typed.convert(2.3, 'string'); // '2.3' 
    ```

-   `typed.create() : function`

    Create a new, isolated instance of typed-function. Example:
    
    ```js
    var typed = require('typed-function');  // default instance
    var typed2 = typed.create();            // a second instance
    ```

-   `typed.find(fn: function, signature: string | Array) : function | null`

    Find a specific signature from a typed function. The function currently
    only finds exact matching signatures.
    
    For example:
    
    ```js
    var fn = typed(...);
    var f = typed.find(fn, ['number', 'string']);
    var f = typed.find(fn, 'number, string');
    ```

-   `typed.addType(type: {name: string, test: function})`

    Add a new type. A type object contains a name and a test function.
    The order of the types determines in which order function arguments are 
    type-checked, so for performance it's important to put the most used types 
    first. All types are added to the Array `typed.types`. 
    
    Example:
    
    ```js
    function Person(...) {
      ...
    }
    
    Person.prototype.isPerson = true;

    typed.addType({
      name: 'Person',
      test: function (x) {
        return x && x.isPerson === true;
      }
    });
    ```
    
-   `typed.addConversion(conversion: {from: string, to: string, convert: function}`

    Add a new conversion. Conversions are added to the Array `typed.conversions`.
    
    ```js
    typed.addConversion({
      from: 'boolean',
      to: 'number',
      convert: function (x) {
        return +x;
    });
    ```
    

### Properties

-   `typed.types: Array.<{name: string, test: function}>`

    Array with types. Each object contains a type name and a test function.
    The order of the types determines in which order function arguments are 
    type-checked, so for performance it's important to put the most used types 
    first. Custom types can be added like:

    ```js
    function Person(...) {
      ...
    }
    
    Person.prototype.isPerson = true;

    typed.types.push({
      name: 'Person',
      test: function (x) {
        return x && x.isPerson === true;
      }
    });
    ```

-   `typed.conversions: Array.<{from: string, to: string, convert: function}>`

    An Array with built-in conversions. Empty by default. Can be used for example
    to defined conversions from `boolean` to `number`. For example:

    ```js
    typed.conversions.push({
      from: 'boolean',
      to: 'number',
      convert: function (x) {
        return +x;
    });
    ```
    
-   `typed.ignore: Array.<string>`

    An Array with names of types to be ignored when creating a typed function.
    This can be useful filter signatures when creating a typed function. Example:

    ```js
    // a set with signatures maybe loaded from somewhere
    var signatures = {
      'number': function () {...},
      'string': function () {...}
    }

    // we want to ignore a specific type
    typed.ignore = ['string'];

    // the created function fn will only contain the 'number' signature 
    var fn = typed('fn', signatures);
    ```


### Output

The functions generated with `typed({...})` have:

- A function `toString`. Returns well readable code which can be used to see
  what the function exactly does. Mostly for debugging purposes.
- A property `signatures`, which holds a map with the (normalized)
  signatures as key and the original sub-functions as value.
- A property `name` containing name of the typed function or an empty string.


## Roadmap

### Version 1

- Be able to turn off exception throwing.
- Extend function signatures:
  - Optional arguments like `'[number], array'` or like `number=, array`
  - Nullable arguments like `'?Object'`
- Create a good benchmark, to get insight in the overhead.
- Allow conversions to fail (for example string to number is not always
  possible). Call this `fallible` or `optional`?

### Version 2

- Extend function signatures:
  - Constants like `'"linear" | "cubic"'`, `'0..10'`, etc.
  - Object definitions like `'{name: string, age: number}'`
  - Object definitions like `'Object.<string, Person>'`
  - Array definitions like `'Array.<Person>'`
- Improve performance of both generating a typed function as well as
  the performance and memory footprint of a typed function.


## Test

To test the library, run:

    npm test


## Minify

To generate the minified version of the library, run:

    npm run minify
