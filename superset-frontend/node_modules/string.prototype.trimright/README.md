String.prototype.trimRight <sup>[![Version Badge][npm-version-svg]][package-url]</sup>

[![Build Status][travis-svg]][travis-url]
[![dependency status][deps-svg]][deps-url]
[![dev dependency status][dev-deps-svg]][dev-deps-url]
[![License][license-image]][license-url]
[![Downloads][downloads-image]][downloads-url]

[![npm badge][npm-badge-png]][package-url]

[![browser support][testling-svg]][testling-url]

A spec-proposal-compliant `String.prototype.trimRight` shim. Invoke its "shim" method to shim `String.prototype.trimRight` if it is unavailable.

This package implements the [es-shim API](https://github.com/es-shims/api) interface. It works in an ES3-supported environment and complies with the [spec](http://www.ecma-international.org/ecma-262/6.0/#sec-object.assign). In an ES6 environment, it will also work properly with `Symbol`s.

Most common usage:
```js
var trimRight = require('string.prototype.trimright');

assert(trimRight(' \t\na \t\n') === 'a \t\n');

if (!String.prototype.trimRight) {
	trimRight.shim();
}

assert(trimRight(' \t\na \t\n ') === ' \t\na \t\n '.trimRight());
```

## Tests
Simply clone the repo, `npm install`, and run `npm test`

[package-url]: https://npmjs.com/package/string.prototype.trimright
[npm-version-svg]: http://vb.teelaun.ch/es-shims/String.prototype.trimRight.svg
[travis-svg]: https://travis-ci.org/es-shims/String.prototype.trimRight.svg
[travis-url]: https://travis-ci.org/es-shims/String.prototype.trimRight
[deps-svg]: https://david-dm.org/es-shims/String.prototype.trimRight.svg
[deps-url]: https://david-dm.org/es-shims/String.prototype.trimRight
[dev-deps-svg]: https://david-dm.org/es-shims/String.prototype.trimRight/dev-status.svg
[dev-deps-url]: https://david-dm.org/es-shims/String.prototype.trimRight#info=devDependencies
[testling-svg]: https://ci.testling.com/es-shims/String.prototype.trimRight.png
[testling-url]: https://ci.testling.com/es-shims/String.prototype.trimRight
[npm-badge-png]: https://nodei.co/npm/string.prototype.trimright.png?downloads=true&stars=true
[license-image]: http://img.shields.io/npm/l/string.prototype.trimright.svg
[license-url]: LICENSE
[downloads-image]: http://img.shields.io/npm/dm/string.prototype.trimright.svg
[downloads-url]: http://npm-stat.com/charts.html?package=string.prototype.trimright
