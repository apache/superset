# gzip-size [![Build Status](https://travis-ci.org/sindresorhus/gzip-size.svg?branch=master)](https://travis-ci.org/sindresorhus/gzip-size)

> Get the gzipped size of a string or buffer


## Install

```
$ npm install gzip-size
```


## Usage

```js
const gzipSize = require('gzip-size');

const text = 'Lorem ipsum dolor sit amet, consectetuer adipiscing elit. Aenean commodo ligula eget dolor. Aenean massa. Cum sociis natoque penatibus et magnis dis parturient montes, nascetur ridiculus mus.';

console.log(text.length);
//=> 191

console.log(gzipSize.sync(text));
//=> 78
```


## API

### gzipSize(input, [options])

Returns a `Promise` for the size.

### gzipSize.sync(input, [options])

Returns the size.

#### input

Type: `string` `Buffer`

#### options

Type: `Object`

Any [`zlib` option](https://nodejs.org/api/zlib.html#zlib_class_options).

### gzipSize.stream([options])

Returns a [`stream.PassThrough`](https://nodejs.org/api/stream.html#stream_class_stream_passthrough). The stream emits a `gzip-size` event and has a `gzipSize` property.

### gzipSize.file(path, [options])

Returns a `Promise` for the size of the file.

#### path

Type: `string`

### gzipSize.fileSync(path, [options])

Returns the size of the file.


## Related

- [gzip-size-cli](https://github.com/sindresorhus/gzip-size-cli) - CLI for this module


## License

MIT © [Sindre Sorhus](https://sindresorhus.com)
