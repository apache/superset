# fs.readdirSyncRecursive

[![NPM version][npm-image]][npm-url]
[![Build status][travis-image]][travis-url]
[![Test coverage][coveralls-image]][coveralls-url]
[![Dependency Status][david-image]][david-url]
[![License][license-image]][license-url]
[![Downloads][downloads-image]][downloads-url]
[![Gittip][gittip-image]][gittip-url]

Read a directory recursively.

## Install

```bash
npm install fs-readdir-recursive
```

## Example

```js
var read = require('fs-readdir-recursive')
read(__dirname) === [
  'test/test.js',
  'index.js',
  'LICENSE',
  'package.json',
  'README.md'
]
```

## API

### read(root [, filter])

`root` is the directory you wish to scan. `filter` is an optional filter for the files with three params(name, index, dir). By default, filter is:

```js
function (name) {
  return name[0] !== '.'
}
```

Which basically just ignores `.` files.

[npm-image]: https://img.shields.io/npm/v/fs-readdir-recursive.svg?style=flat-square
[npm-url]: https://npmjs.org/package/fs-readdir-recursive
[github-tag]: http://img.shields.io/github/tag/fs-utils/fs-readdir-recursive.svg?style=flat-square
[github-url]: https://github.com/fs-utils/fs-readdir-recursive/tags
[travis-image]: https://img.shields.io/travis/fs-utils/fs-readdir-recursive.svg?style=flat-square
[travis-url]: https://travis-ci.org/fs-utils/fs-readdir-recursive
[coveralls-image]: https://img.shields.io/coveralls/fs-utils/fs-readdir-recursive.svg?style=flat-square
[coveralls-url]: https://coveralls.io/r/fs-utils/fs-readdir-recursive
[david-image]: http://img.shields.io/david/fs-utils/fs-readdir-recursive.svg?style=flat-square
[david-url]: https://david-dm.org/fs-utils/fs-readdir-recursive
[license-image]: http://img.shields.io/npm/l/fs-readdir-recursive.svg?style=flat-square
[license-url]: LICENSE
[downloads-image]: http://img.shields.io/npm/dm/fs-readdir-recursive.svg?style=flat-square
[downloads-url]: https://npmjs.org/package/fs-readdir-recursive
[gittip-image]: https://img.shields.io/gratipay/jonathanong.svg?style=flat-square
[gittip-url]: https://gratipay.com/jonathanong/
