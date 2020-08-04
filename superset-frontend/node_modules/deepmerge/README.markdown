deepmerge
=========

> ~540B gzipped, ~1.1kB minified

Merge the enumerable attributes of two objects deeply.

the future
----------

Should we publish a version 2?  [Give your opinion.](https://github.com/KyleAMathews/deepmerge/issues/72)

example
=======

<!--js
var merge = require('./')
-->

```js
var x = {
    foo: { bar: 3 },
    array: [{
        does: 'work',
        too: [ 1, 2, 3 ]
    }]
}

var y = {
    foo: { baz: 4 },
    quux: 5,
    array: [{
        does: 'work',
        too: [ 4, 5, 6 ]
    }, {
        really: 'yes'
    }]
}

var expected = {
    foo: {
        bar: 3,
        baz: 4
    },
    array: [{
        does: 'work',
        too: [ 1, 2, 3, 4, 5, 6 ]
    }, {
        really: 'yes'
    }],
    quux: 5
}

merge(x, y) // => expected
```

methods
=======

```
var merge = require('deepmerge')
```

merge(x, y, [options])
-----------

Merge two objects `x` and `y` deeply, returning a new merged object with the
elements from both `x` and `y`.

If an element at the same key is present for both `x` and `y`, the value from
`y` will appear in the result.

Merging creates a new object, so that neither `x` or `y` are be modified.  However, child objects on `x` or `y` are copied over - if you want to copy all values, you must pass `true` to the clone option.

merge.all(arrayOfObjects, [options])
-----------

Merges two or more objects into a single result object.

```js
var x = { foo: { bar: 3 } }
var y = { foo: { baz: 4 } }
var z = { bar: 'yay!' }

var expected = { foo: { bar: 3, baz: 4 }, bar: 'yay!' }

merge.all([x, y, z]) // => expected
```

### options

#### arrayMerge

The merge will also merge arrays and array values by default.  However, there are nigh-infinite valid ways to merge arrays, and you may want to supply your own.  You can do this by passing an `arrayMerge` function as an option.

```js
function concatMerge(destinationArray, sourceArray, options) {
	destinationArray // => [1, 2, 3]
	sourceArray // => [3, 2, 1]
	options // => { arrayMerge: concatMerge }
	return destinationArray.concat(sourceArray)
}
merge([1, 2, 3], [3, 2, 1], { arrayMerge: concatMerge }) // => [1, 2, 3, 3, 2, 1]
```

To prevent arrays from being merged:

```js
const dontMerge = (destination, source) => source
const output = merge({ coolThing: [1,2,3] }, { coolThing: ['a', 'b', 'c'] }, { arrayMerge: dontMerge })
output // => { coolThing: ['a', 'b', 'c'] }
```

#### clone

Defaults to `false`.  If `clone` is `true` then both `x` and `y` are recursively cloned as part of the merge.

install
=======

With [npm](http://npmjs.org) do:

```sh
npm install deepmerge
```

Just want to download the file without using any package managers/bundlers?  [Download the UMD version from unpkg.com](https://unpkg.com/deepmerge/dist/umd.js).

test
====

With [npm](http://npmjs.org) do:

```sh
npm test
```

license
=======

MIT
