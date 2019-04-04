# check-types.js

[![Build status](https://gitlab.com/philbooth/check-types.js/badges/master/pipeline.svg)](https://gitlab.com/philbooth/check-types.js/pipelines)
[![Package status](https://img.shields.io/npm/v/check-types.svg)](https://www.npmjs.com/package/check-types)
[![Downloads](https://img.shields.io/npm/dm/check-types.svg)](https://www.npmjs.com/package/check-types)
[![License](https://img.shields.io/npm/l/check-types.svg)](https://opensource.org/licenses/MIT)

A little JavaScript library
for asserting types
and values.

* [Why would I want that?](#why-would-i-want-that)
* [How little is it?](#how-little-is-it)
* [How do I install it?](#how-do-i-install-it)
* [How do I use it?](#how-do-i-use-it)
    * [Loading the library](#loading-the-library)
    * [Calling the exported functions](#calling-the-exported-functions)
        * [General predicates](#general-predicates)
        * [String predicates](#string-predicates)
        * [Number predicates](#number-predicates)
        * [Boolean predicates](#boolean-predicates)
        * [Object predicates](#object-predicates)
        * [Array predicates](#array-predicates)
        * [Date predicates](#date-predicates)
        * [Error predicates](#error-predicates)
        * [Function predicates](#function-predicates)
        * [Modifiers](#modifiers)
        * [Batch operations](#batch-operations)
        * [Some examples](#some-examples)
* [Are there TypeScript definitions?](#are-there-typescript-definitions)
* [Where can I use it?](#where-can-i-use-it)
* [What changed from 6.x to 7.x?](#what-changed-from-6x-to-7x)
* [What changed from 5.x to 6.x?](#what-changed-from-5x-to-6x)
* [What changed from 4.x to 5.x?](#what-changed-from-4x-to-5x)
* [What changed from 3.x to 4.x?](#what-changed-from-3x-to-4x)
* [What changed from 2.x to 3.x?](#what-changed-from-2x-to-3x)
* [What changed from 1.x to 2.x?](#what-changed-from-1x-to-2x)
* [What changed from 0.x to 1.x?](#what-changed-from-0x-to-1x)
* [How do I set up the build environment?](#how-do-i-set-up-the-build-environment)
* [What license is it released under?](#what-license-is-it-released-under)

## Why would I want that?

Writing explicit conditions
in your functions
to check arguments
and throw exceptions
is a task that
swiftly becomes tiresome
and adds complexity
to your codebase.

The purpose of check-types.js
is to remove this burden
from JavaScript application developers
in an efficient and robust manner,
abstracted by a simple API.

## How little is it?

21 kb unminified with comments, 6.1 kb minified, 2.2 kb minified + gzipped.

## How do I install it?

Via npm:

```
npm i check-types --save
```

Or if you just want the git repo:

```
git clone git@gitlab.com:philbooth/check-types.js.git
```

If you're into
other package managers,
it is also available
from Bower, Component and Jam.

## How do I use it?

### Loading the library

If you are running in
Node.js,
Browserify
or another CommonJS-style
environment,
you can `require`
check-types like so:

```javascript
var check = require('check-types');
```

It also the supports
the AMD-style format
preferred by Require.js.

If you are
including check-types.js
with an HTML `<script>` tag,
or neither of the above environments
are detected,
it will export the interface globally as `check`.

### Calling the exported functions

Once you've loaded the library
in your application,
a whole bunch of functions are available
to call.

Most of the functions
are predicates,
which can be executed
in a number of different contexts:

* `check.xxx(thing)`:
  These functions are basic predicates,
  returning true or false
  depending on the type and value of `thing`.

* `check.not.xxx(thing)`:
  The `not` modifier
  negates predicates,
  returning `true` if the predicate returns `false`
  and `false` if the predicate returns `true`.
  It is also itself a function,
  which simply returns
  the negation of
  its argument.

* `check.maybe.xxx(thing)`:
  The `maybe` modifier
  tweaks predicates to
  return `true` if `thing` is `null` or `undefined`,
  otherwise their normal result
  is returned.
  It is also itself a function,
  which returns `true`
  when its argument is `null` or `undefined`,
  otherwise it returns its argument.

* `check.assert.xxx(thing, message)`:
  The `assert` modifier
  changes predicates
  to throw when their result is `false`,
  otherwise it returns `thing`.
  It can be applied
  to the `not` and `maybe` modifiers
  using the forms
  `check.assert.not.xxx(thing, message)` and
  `check.assert.maybe.xxx(thing, message)`.
  It is also itself a function,
  which simply throws
  when its argument is false.

* `check.array.of.xxx(thing)`:
  The `array.of` modifier
  first checks that
  it is operating on an array
  and then applies
  the modified predicate
  to each item
  of the array.
  If the predicate fails
  for any item,
  it returns `false`,
  otherwise it returns `true`.
  It can also be prefixed
  by other modifiers,
  so `check.maybe.array.of`,
  `check.not.array.of`,
  `check.assert.array.of`,
  `check.assert.maybe.array.of` and
  `check.assert.not.array.of`
  all work
  as you would expect
  them to.

* `check.arrayLike.of.xxx(thing)`:
  The `arrayLike.of` modifier
  is synonymous with `array.of`,
  except it operates on array-like objects.

* `check.iterable.of.xxx(thing)`:
  The `iterable.of` modifier
  is synonymous with `array.of`,
  except it operates on iterables.

* `check.object.of.xxx(thing)`:
  The `object.of` modifier
  is synonymous with `array.of`,
  except it operates on an object's properties.

Additionally, there are some batch operations
that allow you to apply different predicates
to each value
in an array or object.
These are implemented by
`check.apply`,
`check.map`,
`check.any` and
`check.all`.

#### General predicates

* `check.equal(thing, thang)`:
  Returns `true`
  if `thing === thang`,
  `false` otherwise.

* `check.null(thing)`:
  Returns `true`
  if `thing` is `null`,
  `false` otherwise.

* `check.undefined(thing)`:
  Returns `true`
  if `thing` is `undefined`,
  `false` otherwise.

* `check.assigned(thing)`:
  Returns `true`
  if `thing` is not
  `null` or `undefined`,
  `false` otherwise.

* `check.primitive(thing)`:
  Returns `true`
  if `thing` is a primitive type,
  `false` otherwise.
  Primitive types are
  `null`, `undefined`, booleans, numbers, strings and symbols.

* `check.hasLength(thing, value)`:
  Returns `true`
  if `thing` has a length property
  that equals `value`,
  `false` otherwise.

#### String predicates

* `check.string(thing)`:
  Returns `true`
  if `thing` is a string,
  `false` otherwise.

* `check.emptyString(thing)`:
  Returns `true`
  if `thing` is the empty string,
  `false` otherwise.

* `check.nonEmptyString(thing)`:
  Returns `true`
  if `thing` is a non-empty string,
  `false` otherwise.

* `check.contains(thing, substring)`:
  Returns `true`
  if `thing` is a string
  that contains `substring`,
  `false` otherwise.

* `check.match(thing, regex)`:
  Returns `true`
  if `thing` is a string
  that matches `regex`,
  `false` otherwise.

#### Number predicates

* `check.number(thing)`:
  Returns `true`
  if `thing` is a number,
  `false` otherwise.
  Note that
  `NaN`,
  `Number.POSITIVE_INFINITY` and
  `Number.NEGATIVE_INFINITY`
  are not considered numbers here.

* `check.integer(thing)`:
  Returns `true`
  if `thing` is an integer,
  `false` otherwise.

* `check.zero(thing)`:
  Returns `true`
  if `thing` is zero,
  `false` otherwise.

* `check.infinity(thing)`:
  Returns `true`
  if `thing` is positive or negative infinity,
  `false` otherwise.

* `check.greater(thing, value)`:
  Returns `true` if `thing` is a number
  greater than `value`,
  `false` otherwise.

* `check.greaterOrEqual(thing, value)`:
  Returns `true` if `thing` is a number
  greater than or equal to `value`,
  `false` otherwise.

* `check.less(thing, value)`:
  Returns `true` if `thing` is a number
  less than `value`,
  `false` otherwise.

* `check.lessOrEqual(thing, value)`:
  Returns `true` if `thing` is a number
  less than or equal to `value`,
  `false` otherwise.

* `check.between(thing, a, b)`:
  Returns `true` if `thing` is a number
  between `a` and `b`
  (excluding `a` and `b`),
  `false` otherwise.
  The arguments `a` and `b`
  may be in any order,
  it doesn't matter
  which is greater.

* `check.inRange(thing, a, b)`:
  Returns `true` if `thing` is a number
  in the range `a` .. `b`
  (including `a` and `b`),
  `false` otherwise.
  The arguments `a` and `b`
  may be in any order,
  it doesn't matter
  which is greater.

* `check.positive(thing)`:
  Returns `true` if `thing` is a number
  greater than zero,
  `false` otherwise.

* `check.negative(thing)`:
  Returns `true`
  if `thing` is a number
  less than zero,
  `false` otherwise.

* `check.odd(thing)`:
  Returns `true`
  if `thing` is an odd number,
  `false` otherwise.

* `check.even(thing)`:
  Returns `true`
  if `thing` is an even number,
  `false` otherwise.

#### Boolean predicates

* `check.boolean(thing)`:
  Returns `true`
  if `thing` is a boolean,
  `false` otherwise.

#### Object predicates

* `check.object(thing)`:
  Returns `true`
  if `thing` is a plain-old JavaScript object,
  `false` otherwise.

* `check.emptyObject(thing)`:
  Returns `true`
  if `thing` is an empty object,
  `false` otherwise.

* `check.nonEmptyObject(thing)`:
  Returns `true`
  if `thing` is a non-empty object,
  `false` otherwise.

* `check.instanceStrict(thing, prototype)`:
  Returns `true`
  if `thing` is an instance of `prototype`,
  `false` otherwise.

* `check.instance(thing, prototype)`:
  Returns `true`
  if `thing` is an instance of `prototype`,
  `false` otherwise.
  Falls back to testing
  `constructor.name` and `Object.prototype.toString`
  if the `instanceof` test fails.

* `check.like(thing, duck)`:
  Duck-typing checker.
  Returns `true`
  if `thing` has all of the properties of `duck`,
  `false` otherwise.

#### Array predicates

* `check.array(thing)`:
  Returns `true`
  if `thing` is an array,
  `false` otherwise.

* `check.emptyArray(thing)`:
  Returns `true`
  if `thing` is an empty array,
  `false` otherwise.

* `check.nonEmptyArray(thing)`:
  Returns `true`
  if `thing` is a non-empty array,
  `false` otherwise.

* `check.arrayLike(thing)`:
  Returns `true`
  if `thing` has a numeric length property,
  `false` otherwise.

* `check.iterable(thing)`:
  Returns `true`
  if `thing` implements the iterable protocol,
  `false` otherwise.
  In pre-ES6 environments,
  this predicate falls back
  to `arrayLike` behaviour.

* `check.includes(thing, value)`:
  Returns `true`
  if `thing` includes `value`,
  `false` otherwise.

#### Date predicates

* `check.date(thing)`:
  Returns `true`
  if `thing` is a valid date,
  `false` otherwise.

#### Function predicates

* `check.function(thing)`:
  Returns `true`
  if `thing` is a function,
  `false` otherwise.

#### Modifiers

* `check.not(value)`:
  Returns the negation
  of `value`.

* `check.not.xxx(...)`:
  Returns the negation
  of the predicate.

* `check.maybe(value)`:
  Returns `true`
  if `value` is `null` or `undefined`,
  otherwise it returns `value`.

* `check.maybe.xxx(...)`:
  Returns `true`
  if `thing` is `null` or `undefined`,
  otherwise it propagates
  the return value
  from its predicate.

* `check.array.of.xxx(value)`:
  Returns `true`
  if `value` is an array
  and the predicate is true
  for every item.
  Also works with the `not` and `maybe` modifiers.

* `check.arrayLike.of.xxx(thing)`:
  The `arrayLike.of` modifier
  is synonymous with `array.of`,
  except it operates on array-like objects.

* `check.iterable.of.xxx(thing)`:
  The `iterable.of` modifier
  is synonymous with `array.of`,
  except it operates on iterables.

* `check.object.of.xxx(thing)`:
  The `object.of` modifier
  is synonymous with `array.of`,
  except it operates on an object's properties.

* `check.assert(value, message, ErrorType)`:
  Throws a `TypeError`
  if `value` is *falsy*,
  otherwise it returns `value`.
  `message` and `ErrorType`
  are optional arguments
  that control
  the message and type
  of the thrown error object.

* `check.assert.xxx(...)`:
  Throws a `TypeError`
  if the predicate returns false,
  otherwise it returns the subject value.
  The last two arguments
  are an optional message and error type
  that control
  the message and type
  of the thrown error object.
  Also works with the `not`, `maybe` and `...of` modifiers.

#### Batch operations

* `check.apply(things, predicates)`:
  Applies each value from the `things` array
  to the corresponding predicate
  and returns the array of results.
  Passing a single predicate
  instead of an array
  applies all of the values
  to the same predicate.

* `check.map(things, predicates)`:
  Maps each value from the `things` object
  to the corresponding predicate
  and returns an object
  containing the results.
  Supports nested objects.
  Passing a single predicate
  instead of an object
  applies all of the values
  to the same predicate,
  ignoring nested objects.

* `check.all(results)`:
  Returns `true`
  if all the result values are true
  in an array (returned from `apply`)
  or object (returned from `map`).

* `check.any(predicateResults)`:
  Returns `true`
  if any result value is true
  in an array (returned from `apply`)
  or object (returned from `map`).

#### Some examples

```javascript
check.even(3);
// Returns false
```

```javascript
check.not.even(3);
// Returns true
```

```javascript
check.maybe.even(null);
// Returns true
```

```javascript
check.assert.like({ foo: 'bar' }, { baz: 'qux' });
// Throws `new TypeError('Invalid type')`
```

```javascript
check.assert.not.like({ foo: 'bar' }, { baz: 'qux' });
// Doesn't throw, returns `{ foo: 'bar' }`
```

```javascript
check.assert.maybe.like(undefined, { foo: 'bar' });
// Doesn't throw, returns `undefined`
```

```javascript
check.assert(myFunction(), 'Something went wrong', CustomError);
// Throws `new CustomError('Something went wrong')` if myFunction returns `false`
```

```javascript
check.apply([ 'foo', 'bar', '' ], check.nonEmptyString);
// Returns [ true, true, false ]
```

```javascript
check.map({
    foo: 2,
    bar: { baz: 'qux' }
}, {
    foo: check.odd,
    bar: { baz: check.nonEmptyString }
});
// Returns { foo: false, bar: { baz: true } }
```

```javascript
check.all(
    check.map(
        { foo: 0, bar: '' },
        { foo: check.number, bar: check.string }
    )
);
// Returns true
```

```javascript
check.any(
    check.apply(
        [ 1, 2, 3, '' ],
        check.string
    )
);
// Returns true
```

## Are there TypeScript definitions?

[Yes](https://www.npmjs.com/package/@types/check-types)!

Thanks to [@idchlife](https://github.com/idchlife),
type definitions [were added](https://github.com/DefinitelyTyped/DefinitelyTyped/commit/d19ddb855dea08105a3d7450a98696c7bcd62f60)
to [DefinitelyTyped].
You can add them to your project
via npm:

```
npm i @types/check-types --save-dev
```

## Where can I use it?

As of version 2.0,
this library no longer supports ES3.
That means you can't use it
in IE 7 or 8.

Everywhere else should be fine.

If those versions of IE
are important to you,
worry not!
The 1.x versions
all support old IE
and any future 1.x versions
will adhere to that too.

See the [releases]
for more information.

## What changed from 6.x to 7.x?

Breaking changes
were made to the API
in version 7.0.0.

Specifically,
the `instance` predicate
was renamed to `instanceStrict`
and the `builtIn` and `userDefined` predicates
were combined to form
a new `instance` predicate.

See the [history][history7]
for more details.

## What changed from 5.x to 6.x?

Breaking changes
were made to the API
in version 6.0.0.

Specifically,
the `either` modifier was removed.
Instead,
calling code can use
the `any` function,
or simply express the boolean logic
in JS.

See the [history][history6]
for more details.

## What changed from 4.x to 5.x?

Breaking changes
were made to the API
in version 5.0.0.

Specifically,
the predicates `isMap` and `error` were removed
in favour of the new predicate `builtIn`,
which can be used to test for
all built-in objects.

See the [history][history5]
for more details.

## What changed from 3.x to 4.x?

Breaking changes
were made to the API
in version 4.0.0.

Specifically,
the predicate `unemptyString`
was renamed to `nonEmptyString`
and the predicate `error`
was changed to support
derived Error objects.

See the [history][history4]
for more details.

## What changed from 2.x to 3.x?

Breaking changes
were made to the API
in version 3.0.0.

Specifically,
the predicate `length`
was renamed to `hasLength`
and the predicate `webUrl`
was removed.

See the [history][history3]
for more details.

## What changed from 1.x to 2.x?

Breaking changes
were made to the API
in version 2.0.0.

Specifically:

* Support for ES3 was dropped
* The predicates `gitUrl`, `email` and `floatNumber` were removed.
* `verify` was renamed to `assert`.
* `nulled` was renamed to `null`.
* `oddNumber` was renamed to `odd`.
* `evenNumber` was renamed to `even`.
* `positiveNumber` was renamed to `positive`.
* `negativeNumber` was renamed to `negative`.
* `intNumber` was renamed to `integer`.
* `bool` was renamed to `boolean`.
* `defined` was swapped to become `undefined`.
* `webUrl` was tightened to reject more cases.

See the [history][history2]
for more details.

## What changed from 0.x to 1.x?

Breaking changes
were made to the API
in version 1.0.0.

Specifically,
all of the predicates
were renamed
from `check.isXxxx`
to `check.xxx` and
all of the verifiers
were renamed
from `check.verifyXxxx`
to `check.verify.xxx`.

See the [history][history1]
for more details.

## How do I set up the build environment?

The build environment relies on
[Node.js][node],
[NPM],
[JSHint],
[Mocha],
[Chai],
[UglifyJS] and
[please-release-me].
Assuming that you already have Node.js and NPM set up,
you just need to run `npm install` to
install all of the dependencies as listed in `package.json`.

The unit tests are in `test/check-types.js`.
You can run them with the command `npm test`.
To run the tests in a web browser,
open `test/check-types.html`.

## What license is it released under?

[MIT][license]

[definitelytyped]: https://github.com/DefinitelyTyped/DefinitelyTyped
[releases]: https://gitlab.com/philbooth/check-types.js/tags
[history7]: HISTORY.md#70
[history6]: HISTORY.md#60
[history5]: HISTORY.md#50
[history4]: HISTORY.md#40
[history3]: HISTORY.md#30
[history2]: HISTORY.md#20
[history1]: HISTORY.md#10
[node]: http://nodejs.org/
[npm]: https://npmjs.org/
[jshint]: https://github.com/jshint/node-jshint
[mocha]: http://mochajs.org/
[chai]: http://chaijs.com/
[uglifyjs]: https://github.com/mishoo/UglifyJS
[please-release-me]: https://gitlab.com/philbooth/please-release-me
[license]: https://gitlab.com/philbooth/check-types.js/blob/master/COPYING

