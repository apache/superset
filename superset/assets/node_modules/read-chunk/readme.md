# read-chunk [![Build Status](https://travis-ci.org/sindresorhus/read-chunk.svg?branch=master)](https://travis-ci.org/sindresorhus/read-chunk)

> Read a chunk from a file

Because the built-in way is too much boilerplate.


## Install

```sh
$ npm install --save read-chunk
```


## Usage

```js
var readChunk = require('read-chunk');

// foo.txt => hello

readChunk.sync('foo.txt', 1, 3);
//=> ell
```


## API

### readChunk(filepath, position, length, callback)

#### filepath

Type: `string`

#### position

Type: `number`

Position to start reading.

#### length

Type: `number`

Number of bytes to read.

#### callback(error, buffer)

Type: `function`


### readChunk.sync(filepath, start, length)

Same arguments as `readChunk` except the callback.

Returns a buffer.


## License

MIT © [Sindre Sorhus](http://sindresorhus.com)
