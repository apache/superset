<p align="center">
  <a href="http://gulpjs.com">
    <img height="257" width="114" src="https://raw.githubusercontent.com/gulpjs/artwork/master/gulp-2x.png">
  </a>
</p>

# v8flags

[![NPM version][npm-image]][npm-url] [![Downloads][downloads-image]][npm-url] [![Travis Build Status][travis-image]][travis-url] [![AppVeyor Build Status][appveyor-image]][appveyor-url] [![Coveralls Status][coveralls-image]][coveralls-url] [![Gitter chat][gitter-image]][gitter-url]

Get available v8 flags.

## Usage
```js
const v8flags = require('v8flags');

v8flags(function(err, results) {
  console.log(results);
  // [ '--use_strict',
  //   '--es5_readonly',
  //   '--es52_globals',
  //   '--harmony_typeof',
  //   '--harmony_scoping',
  //   '--harmony_modules',
  //   '--harmony_proxies',
  //   '--harmony_collections',
  //   '--harmony',
  // ...
});
```

## API

### `v8flags(cb)`

Finds the available flags and calls the passed callback with any errors and an array of flag results.

### `v8flags.configfile`

The name of the cache file for flags.

### `v8flags.configPath`

The filepath location of the `configfile` above.

## License

MIT

[downloads-image]: http://img.shields.io/npm/dm/v8flags.svg
[npm-url]: https://www.npmjs.com/package/v8flags
[npm-image]: http://img.shields.io/npm/v/v8flags.svg

[travis-url]: https://travis-ci.org/gulpjs/v8flags
[travis-image]: http://img.shields.io/travis/gulpjs/v8flags.svg?label=travis-ci

[appveyor-url]: https://ci.appveyor.com/project/gulpjs/v8flags
[appveyor-image]: https://img.shields.io/appveyor/ci/gulpjs/v8flags.svg?label=appveyor

[coveralls-url]: https://coveralls.io/r/gulpjs/v8flags
[coveralls-image]: http://img.shields.io/coveralls/gulpjs/v8flags/master.svg

[gitter-url]: https://gitter.im/gulpjs/gulp
[gitter-image]: https://badges.gitter.im/gulpjs/gulp.svg
