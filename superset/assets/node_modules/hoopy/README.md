# hoopy

[![Build status](https://gitlab.com/philbooth/hoopy/badges/master/pipeline.svg)](https://gitlab.com/philbooth/hoopy/pipelines)
[![Package status](https://img.shields.io/npm/v/hoopy.svg)](https://www.npmjs.com/package/hoopy)
[![Downloads](https://img.shields.io/npm/dm/hoopy.svg)](https://www.npmjs.com/package/hoopy)
[![License](https://img.shields.io/npm/l/hoopy.svg)](https://opensource.org/licenses/MIT)


Like an array, but rounder.

* [Huh?](#huh)
* [What's it useful for?](#whats-it-useful-for)
* [How do I install it?](#how-do-i-install-it)
* [How do I use it?](#how-do-i-use-it)
  * [Loading the library](#loading-the-library)
  * [Creating arrays](#creating-arrays)
  * [Accessing array items](#accessing-array-items)
  * [Growing the array](#growing-the-array)
* [Is there a change log?](#is-there-a-change-log)
* [How do I set up the dev environment?](#how-do-i-set-up-the-dev-environment)
* [What license is it released under?](#what-license-is-it-released-under)

## Huh?

Hoopy is a circular array
data type.
It extends `Array`
so that out-of-bounds indices
wrap back round
to the start of the array
(or if they're negative indices,
they wrap back round
to the end of the array).

## What's it useful for?

If you want a fixed-length buffer
for streamed I/O,
Hoopy can do that for you.

## How do I install it?

Via `npm`:

```
npm i hoopy --save
```

Or if you just want the git repo:

```
git clone git@gitlab.com:philbooth/hoopy.git
```

## How do I use it?

### Loading the library

```js
const Hoopy = require('hoopy');
```

### Creating arrays

```js
const hoopy = new Hoopy(10);
assert(Array.isArray(hoopy));
```

You must pass
a `size` argument
to the `Hoopy` constructor,
otherwise it will throw.

### Accessing array items

```js
for (let i = 0; i < hoopy.length; ++i) {
  hoopy[i] = i;
  console.log(hoopy[i]);
}
```

You can read and write array items
using square brackets for indexing
as you would with a normal array.
However, if you write to
an out-of-bounds index,
it will not increase
the length of the array.
Instead the index is applied
modulo the array length,
wrapping back round to the start.
Negative indices work in reverse,
wrapping back round to the end
of the array.

The methods
`push`, `pop`, `shift` and `unshift`
will throw if called.
Future versions of the library
may implement sane behaviour
for them.
All of the other `Array` methods
work normally.

### Growing the array

```js
hoopy.grow(50);
```

The `grow` method
adds items to the array.
It takes one argument,
which is the number
of items to grow the array by.
The new length of the array
will be the old length
plus the number you pass to `grow`.

If the current state of the array
includes overflowed indices,
`grow` will take care
to move those items
in to the freshly-created
available space,
so that the correct order is maintained
for your data.

The caller is responsible
for ensuring they don't overwrite
unprocessed items.
If you need to increase
the size of the array,
you must call `grow`.

## Is there a change log?

[Yes](CHANGELOG.md).

## How do I set up the dev environment?

To install the dependencies:

```
npm i
```

To run the tests:

```
npm t
```

To lint the code:

```
npm run lint
```

## What license is it released under?

[MIT](LICENSE).

