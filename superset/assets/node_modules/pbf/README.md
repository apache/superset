# pbf

[![build status](https://secure.travis-ci.org/mapbox/pbf.svg)](http://travis-ci.org/mapbox/pbf) [![Coverage Status](https://coveralls.io/repos/mapbox/pbf/badge.svg)](https://coveralls.io/r/mapbox/pbf)

A low-level, fast, ultra-lightweight (3KB gzipped) JavaScript library for decoding and encoding [protocol buffers](https://developers.google.com/protocol-buffers), a compact binary format for structured data serialization. Works both in Node and the browser. Supports lazy decoding and detailed customization of the reading/writing code.

## Performance

This library is extremely fast — much faster than native `JSON.parse`/`JSON.stringify`
and the [protocol-buffers](https://github.com/mafintosh/protocol-buffers) module.
Here's a result from running a real-world benchmark on Node v6.5
(decoding and encoding a sample of 439 vector tiles, 22.6 MB total):

- **pbf** decode: 387ms, or 57 MB/s
- **pbf** encode: 396ms, or 56 MB/s
- **protocol-buffers** decode: 837ms, or 26 MB/s
- **protocol-buffers** encode: 4197ms, or 5 MB/s
- **JSON.parse**: 1540ms, or 125 MB/s (parsing an equivalent 77.5 MB JSON file)
- **JSON.stringify**: 607ms, or 49 MB/s

## Examples

#### Using Compiled Code

Install `pbf` and compile a JavaScript module from a `.proto` file:

```bash
$ npm install -g pbf
$ pbf example.proto > example.js
```

Then read and write objects using the module like this:

```js
var Pbf = require('pbf');
var Example = require('./example.js').Example;

// read
var pbf = new Pbf(buffer);
var obj = Example.read(pbf);

// write
var pbf = new Pbf();
Example.write(obj, pbf);
var buffer = pbf.finish();
```

Alternatively, you can compile a module directly in the code:

```js
var compile = require('pbf/compile');
var schema = require('protocol-buffers-schema');

var proto = schema.parse(fs.readFileSync('example.proto'));
var Test = compile(proto).Test;
```

If you use `webpack` as your module bundler, you can use [pbf-loader](https://github.com/trivago/pbf-loader)
to load .proto files directly. It returns a compiled module ready to be used.

Given you already configured your `webpack.config.js`, the code above would look like:
```js
var Pbf = require('pbf');
var proto = require('./example.proto');

var Test = proto.Test;
```

#### Custom Reading

```js
var data = new Pbf(buffer).readFields(readData, {});

function readData(tag, data, pbf) {
    if (tag === 1) data.name = pbf.readString();
    else if (tag === 2) data.version = pbf.readVarint();
    else if (tag === 3) data.layer = pbf.readMessage(readLayer, {});
}
function readLayer(tag, layer, pbf) {
    if (tag === 1) layer.name = pbf.readString();
    else if (tag === 3) layer.size = pbf.readVarint();
}
```

#### Custom Writing

```js
var pbf = new Pbf();
writeData(data, pbf);
var buffer = pbf.finish();

function writeData(data, pbf) {
    pbf.writeStringField(1, data.name);
    pbf.writeVarintField(2, data.version);
    pbf.writeMessage(3, writeLayer, data.layer);
}
function writeLayer(layer, pbf) {
    pbf.writeStringField(1, layer.name);
    pbf.writeVarintField(2, layer.size);
}
```

## Install

Node and Browserify:

```bash
npm install pbf
```

Making a browser build:

```bash
npm install
npm run build-dev # dist/pbf-dev.js (development build)
npm run build-min # dist/pbf.js (minified production build)
```

CDN link: https://unpkg.com/pbf@3.0.5/dist/pbf.js

## API

Create a `Pbf` object, optionally given a `Buffer` or `Uint8Array` as input data:

```js
// parse a pbf file from disk in Node
var pbf = new Pbf(fs.readFileSync('data.pbf'));

// parse a pbf file in a browser after an ajax request with responseType="arraybuffer"
var pbf = new Pbf(new Uint8Array(xhr.response));
```

`Pbf` object properties:

```js
pbf.length; // length of the underlying buffer
pbf.pos; // current offset for reading or writing
```

#### Reading

Read a sequence of fields:

```js
pbf.readFields(function (tag) {
    if (tag === 1) pbf.readVarint();
    else if (tag === 2) pbf.readString();
    else ...
});
```

It optionally accepts an object that will be passed to the reading function for easier construction of decoded data,
and also passes the `Pbf` object as a third argument:

```js
var result = pbf.readFields(callback, {})

function callback(tag, result, pbf) {
    if (tag === 1) result.id = pbf.readVarint();
}
```

To read an embedded message, use `pbf.readMessage(fn[, obj])` (in the same way as `read`).

Read values:

```js
var value = pbf.readVarint();
var str = pbf.readString();
var numbers = pbf.readPackedVarint();
```

For lazy or partial decoding, simply save the position instead of reading a value,
then later set it back to the saved value and read:

```js
var fooPos = -1;
pbf.readFields(function (tag) {
    if (tag === 1) fooPos = pbf.pos;
});
...
pbf.pos = fooPos;
pbf.readMessage(readFoo);
```

Scalar reading methods:

* `readVarint(isSigned)` (pass `true` if you expect negative varints)
* `readSVarint()`
* `readFixed32()`
* `readFixed64()`
* `readSFixed32()`
* `readSFixed64()`
* `readBoolean()`
* `readFloat()`
* `readDouble()`
* `readString()`
* `readBytes()`
* `skip(value)`

Packed reading methods:

* `readPackedVarint(arr, isSigned)` (appends read items to `arr`)
* `readPackedSVarint(arr)`
* `readPackedFixed32(arr)`
* `readPackedFixed64(arr)`
* `readPackedSFixed32(arr)`
* `readPackedSFixed64(arr)`
* `readPackedBoolean(arr)`
* `readPackedFloat(arr)`
* `readPackedDouble(arr)`

#### Writing

Write values:

```js
pbf.writeVarint(123);
pbf.writeString("Hello world");
```

Write an embedded message:

```js
pbf.writeMessage(1, writeObj, obj);

function writeObj(obj, pbf) {
    pbf.writeStringField(obj.name);
    pbf.writeVarintField(obj.version);
}
```

Field writing methods:

* `writeVarintField(tag, val)`
* `writeSVarintField(tag, val)`
* `writeFixed32Field(tag, val)`
* `writeFixed64Field(tag, val)`
* `writeSFixed32Field(tag, val)`
* `writeSFixed64Field(tag, val)`
* `writeBooleanField(tag, val)`
* `writeFloatField(tag, val)`
* `writeDoubleField(tag, val)`
* `writeStringField(tag, val)`
* `writeBytesField(tag, buffer)`

Packed field writing methods:

* `writePackedVarint(tag, val)`
* `writePackedSVarint(tag, val)`
* `writePackedSFixed32(tag, val)`
* `writePackedSFixed64(tag, val)`
* `writePackedBoolean(tag, val)`
* `writePackedFloat(tag, val)`
* `writePackedDouble(tag, val)`

Scalar writing methods:

* `writeVarint(val)`
* `writeSVarint(val)`
* `writeSFixed32(val)`
* `writeSFixed64(val)`
* `writeBoolean(val)`
* `writeFloat(val)`
* `writeDouble(val)`
* `writeString(val)`
* `writeBytes(buffer)`

Message writing methods:

* `writeMessage(tag, fn[, obj])`
* `writeRawMessage(fn[, obj])`

Misc methods:

* `realloc(minBytes)` - pad the underlying buffer size to accommodate the given number of bytes;
   note that the size increases exponentially, so it won't necessarily equal the size of data written
* `finish()` - make the current buffer ready for reading and return the data as a buffer slice
* `destroy()` - dispose the buffer

For an example of a real-world usage of the library, see [vector-tile-js](https://github.com/mapbox/vector-tile-js).


## Proto Schema to JavaScript

If installed globally, `pbf` provides a binary that compiles `proto` files into JavaScript modules. Usage:

```bash
$ pbf <proto_path> [--no-write] [--no-read] [--browser]
```

The `--no-write` and `--no-read` switches remove corresponding code in the output.
The `--browser` switch makes the module work in browsers instead of Node.

The resulting module exports each message by name with the following methods:

* `read(pbf)` - decodes an object from the given `Pbf` instance
* `write(obj, pbf)` - encodes an object into the given `Pbf` instance (usually empty)

The resulting code is clean and simple, so feel free to customize it.

## Changelog

#### 3.0.5 (Nov 30, 2016)

- Fixed an error appearing in some versions of IE11 and old Android browsers.

#### 3.0.4 (Nov 14, 2016)

- Fixed compiling repeated packed enum fields.

#### 3.0.3 (Nov 14, 2016)

- Fixed a regression that broke compiling repeated enum fields with defaults.

#### 3.0.2 (Sep 30, 2016)

- Fixed a regression that broke decoding of packed fields with a tag that didn't fit into one byte.

#### 3.0.1 (Sep 20, 2016)

- Fixed a regression that broke encoding of long strings.

#### 3.0.0 (Aug 30, 2016)

This release include tons of compatibility/robustness fixes, and a more reliable Node implementation. Decoding performance is expected to get up to ~15% slower than v2.0 in Node (browsers are unaffected), but encoding got faster by ~15% in return.

##### Encoder/decoder

- **Breaking**: changed Node implementation to use `Uint8Array` instead of `Buffer` internally (and produce corresponding result on `finish()`), making it fully match the browser implementation for consistency and simplicity.
- Fixed `writeVarint` to write `0` when given `NaN` or other non-number to avoid producing a broken Protobuf message.
- Changed `readPacked*` methods signature to accept an optional `arr` argument to append the results to (to support messages with repeated fields that mix packed/non-packed encoding).
- Added an optional `isSigned` argument to `readVarint` that enables proper reading of negative varints.
- Deprecated `readVarint64()` (it still works, but it's recommended to be changed to `readVarint(true)`).
- Faster string encoding.

##### Proto compiler

- **Breaking:** Full support for defaults field values (both implicit and explicit); they're now included in the decoded JSON objects.
- Fixed reading of repeated fields with mixed packed/non-packed encoding for compatibility.
- Fixed proto3 compiler to use packed by default for repeated scalar fields.
- Fixed reading of negative varint types.
- Fixed packed fields to decode into `[]` if they're not present.
- Fixed nested message references handling.
- Fixed `packed=false` being interpreted as packed.
- Added a comment to generated code with pbf version number.

#### 2.0.1 (May 28, 2016)

- Fixed a regression with `writeVarint` that affected certain numbers.

#### 2.0.0 (May 28, 2016)

- Significantly improved the proto compiler, which now produces a much safer reading/writing code.
- Added the ability to compile a read/write module from a protobuf schema directly in the code.
- Proto compiler: fixed name resolutions and collisions in schemas with nested messages.
- Proto compiler: fixed broken top-level enums.

#### 1.3.7 (May 28, 2016)

- Fixed a regression with `writeVarint` that affected certain numbers.

#### 1.3.6 (May 27, 2016)

- Improved read and write performance (both ~15% faster).
- Improved generated code for default values.

#### 1.3.5 (Oct 5, 2015)

- Added support for `syntax` keyword proto files (by updating `resolve-protobuf-schema` dependency).

#### 1.3.4 (Jul 31, 2015)

- Added `writeRawMessage` method for writing a message without a tag, useful for creating pbfs with multiple top-level messages.

#### 1.3.2 (Mar 5, 2015)

- Added `readVarint64` method for proper decoding of negative `int64`-encoded values.

#### 1.3.1 (Feb 20, 2015)

- Fixed pbf proto compile tool generating broken writing code.

#### 1.3.0 (Feb 5, 2015)

- Added `pbf` binary that compiles `.proto` files into `Pbf`-based JavaScript modules.

#### 1.2.0 (Jan 5, 2015)

##### Breaking API changes

- Changed `writeMessage` signature to `(tag, fn, obj)` (see example in the docs)
  for a huge encoding performance improvement.
- Replaced `readPacked` and `writePacked` methods that accept type as a string
  with `readPackedVarint`, etc. for each type (better performance and simpler API).

##### Improvements

- 5x faster encoding in Node (vector tile benchmark).
- 40x faster encoding and 3x faster decoding in the browser (vector tile benchmark).

#### 1.1.4 (Jan 2, 2015)

- Significantly improved `readPacked` and `writePacked` performance (the tile reading benchmark is now 70% faster).

#### 1.1.3 (Dec 26, 2014)

Brings tons of improvements and fixes over the previous version (`0.0.2`).
Basically makes the library complete.

##### Improvements

- Improved performance of both reading and writing.
- Made the browser build 3 times smaller.
- Added convenience `readFields` and `readMessage` methods for a much easier reading API.
- Added reading methods: `readFloat`, `readBoolean`, `readSFixed32`, `readSFixed64`.
- Added writing methods: `writeUInt64`, `writeSFixed32`, `writeSFixed64`.
- Improved `readDouble` and `readString` to use native Buffer methods under Node.
- Improved `readString` and `writeString` to use HTML5 `TextEncoder` and `TextDecoder` where available.
- Made `Pbf` `buffer` argument optional.
- Added extensive docs and examples in the readme.
- Added an extensive test suite that brings test coverage up to 100%.

##### Breaking API changes

- Renamed `readBuffer`/`writeBuffer` to `readBytes`/`writeBytes`.
- Renamed `readUInt32`/`writeUInt32` to `readFixed32`/`writeFixed32`, etc.
- Renamed `writeTaggedVarint` to `writeVarintField`, etc.
- Changed `writePacked` signature from `(type, tag, items)` to `(tag, type, items)`.

##### Bugfixes

- Fixed `readVarint` to handle varints bigger than 6 bytes.
- Fixed `readSVarint` to handle number bigger than `2^30`.
- Fixed `writeVarint` failing on some integers.
- Fixed `writeVarint` not throwing an error on numbers that are too big.
- Fixed `readUInt64` always failing.
- Fixed writing to an empty buffer always failing.
