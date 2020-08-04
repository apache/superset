#object-is <sup>[![Version Badge][2]][1]</sup>

[![Build Status][3]][4] [![dependency status][5]][6] [![dev dependency status][7]][8]

[![npm badge][11]][1]

[![browser support][9]][10]

ES6-compliant shim for Object.is - differentiates between -0 and +0, and can compare to NaN.

Essentially, Object.is returns the same value as === - but true for NaN, and false for -0 and +0.

## Example

```js
Object.is = require('object-is');
var assert = require('assert');

assert.ok(Object.is());
assert.ok(Object.is(undefined));
assert.ok(Object.is(undefined, undefined));
assert.ok(Object.is(null, null));
assert.ok(Object.is(true, true));
assert.ok(Object.is(false, false));
assert.ok(Object.is('foo', 'foo'));

var arr = [1, 2];
assert.ok(Object.is(arr, arr));
assert.notOk(Object.is(arr, [1, 2]));

assert.ok(Object.is(0, 0));
assert.ok(Object.is(-0, -0));
assert.notOk(Object.is(0, -0));

assert.ok(Object.is(NaN, NaN));
assert.ok(Object.is(Infinity, Infinity));
assert.ok(Object.is(-Infinity, -Infinity));
```

## Tests
Simply clone the repo, `npm install`, and run `npm test`

[1]: https://npmjs.org/package/object-is
[2]: http://vb.teelaun.ch/ljharb/object-is.svg
[3]: https://travis-ci.org/ljharb/object-is.svg
[4]: https://travis-ci.org/ljharb/object-is
[5]: https://david-dm.org/ljharb/object-is.svg
[6]: https://david-dm.org/ljharb/object-is
[7]: https://david-dm.org/ljharb/object-is/dev-status.svg
[8]: https://david-dm.org/ljharb/object-is#info=devDependencies
[9]: https://ci.testling.com/ljharb/object-is.png
[10]: https://ci.testling.com/ljharb/object-is
[11]: https://nodei.co/npm/object-is.png?downloads=true&stars=true

