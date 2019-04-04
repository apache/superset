# object-inspect

string representations of objects in node and the browser

[![testling badge](https://ci.testling.com/substack/object-inspect.png)](https://ci.testling.com/substack/object-inspect)

[![build status](https://secure.travis-ci.org/substack/object-inspect.png)](http://travis-ci.org/substack/object-inspect)

# example

## circular

``` js
var inspect = require('object-inspect');
var obj = { a: 1, b: [3,4] };
obj.c = obj;
console.log(inspect(obj));
```

## dom element

``` js
var inspect = require('object-inspect');

var d = document.createElement('div');
d.setAttribute('id', 'beep');
d.innerHTML = '<b>wooo</b><i>iiiii</i>';

console.log(inspect([ d, { a: 3, b : 4, c: [5,6,[7,[8,[9]]]] } ]));
```

output:

```
[ <div id="beep">...</div>, { a: 3, b: 4, c: [ 5, 6, [ 7, [ 8, [ ... ] ] ] ] } ]
```

# methods

``` js
var inspect = require('object-inspect')
```

## var s = inspect(obj, opts={})

Return a string `s` with the string representation of `obj` up to a depth of `opts.depth`.

Additional options:
  - `quoteStyle`: must be "single" or "double", if present

# install

With [npm](https://npmjs.org) do:

```
npm install object-inspect
```

# license

MIT
