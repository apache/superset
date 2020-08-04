# shallow-copy

make a shallow copy of an object or array

[![testling badge](https://ci.testling.com/substack/shallow-copy.png)](https://ci.testling.com/substack/shallow-copy)

[![build status](https://secure.travis-ci.org/substack/shallow-copy.png)](http://travis-ci.org/substack/shallow-copy)

# example

you can copy objects shallowly:

``` js
var copy = require('shallow-copy');

var obj = { a: 3, b: 4, c: [5,6] };
var dup = copy(obj);
dup.b *= 111;
dup.c.push(7);

console.log('original: ', obj);
console.log('copy: ', dup);
```

and you can copy arrays shallowly:

``` js
var copy = require('shallow-copy');

var xs = [ 3, 4, 5, { f: 6, g: 7 } ];
var dup = copy(xs);
dup.unshift(1, 2);
dup[5].g += 100;

console.log('original: ', xs);
console.log('copy: ', dup);
```

# methods

``` js
var copy = require('shallow-copy')
```

## copy(obj)

Return a copy of the enumerable properties of the object `obj` without making
copies of nested objects inside of `obj`.

If `obj` is an array, the result will be an array.
If `obj` is an object, the result will be an object.
If `obj` is not an object, its value is returned.

# install

With [npm](https://npmjs.org) do:

```
npm install shallow-copy
```

# license

MIT
