# function.prototype.name <sup>[![Version Badge][2]][1]</sup>

[![Build Status][3]][4]
[![dependency status][5]][6]
[![dev dependency status][7]][8]
[![License][license-image]][license-url]
[![Downloads][downloads-image]][downloads-url]

[![npm badge][11]][1]

[![browser support][9]][10]

An ES6 spec-compliant `Function.prototype.name` shim. Invoke its "shim" method to shim Function.prototype.name if it is unavailable.
*Note*: `Function#name` requires a true ES5 environment - specifically, one with ES5 getters.

This package implements the [es-shim API](https://github.com/es-shims/api) interface. It works in an ES5-supported environment and complies with the [spec](http://www.ecma-international.org/ecma-262/6.0/#sec-get-regexp.prototype.flags).

Most common usage:

## Example

```js
var functionName = require('function.prototype.name');
var assert = require('assert');

assert.equal(functionName(function foo() {}), 'foo');

functionName.shim();
assert.equal(function foo() {}.name, 'foo');
```

## Tests
Simply clone the repo, `npm install`, and run `npm test`

[1]: https://npmjs.org/package/function.prototype.name
[2]: http://versionbadg.es/ljharb/function.prototype.name.svg
[3]: https://travis-ci.org/ljharb/function.prototype.name.svg
[4]: https://travis-ci.org/ljharb/function.prototype.name
[5]: https://david-dm.org/ljharb/function.prototype.name.svg
[6]: https://david-dm.org/ljharb/function.prototype.name
[7]: https://david-dm.org/ljharb/function.prototype.name/dev-status.svg
[8]: https://david-dm.org/ljharb/function.prototype.name#info=devDependencies
[9]: https://ci.testling.com/ljharb/function.prototype.name.png
[10]: https://ci.testling.com/ljharb/function.prototype.name
[11]: https://nodei.co/npm/function.prototype.name.png?downloads=true&stars=true
[license-image]: http://img.shields.io/npm/l/function.prototype.name.svg
[license-url]: LICENSE
[downloads-image]: http://img.shields.io/npm/dm/function.prototype.name.svg
[downloads-url]: http://npm-stat.com/charts.html?package=function.prototype.name
