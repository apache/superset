# BFJ

[![Build status](https://gitlab.com/philbooth/bfj/badges/master/pipeline.svg)](https://gitlab.com/philbooth/bfj/pipelines)
[![Package status](https://img.shields.io/npm/v/bfj.svg)](https://www.npmjs.com/package/bfj)
[![Downloads](https://img.shields.io/npm/dm/bfj.svg)](https://www.npmjs.com/package/bfj)
[![License](https://img.shields.io/npm/l/bfj.svg)](https://opensource.org/licenses/MIT)

Big-Friendly JSON. Asynchronous streaming functions for large JSON data sets.

* [Why would I want those?](#why-would-i-want-those)
* [Is it fast?](#is-it-fast)
* [What functions does it implement?](#what-functions-does-it-implement)
* [How do I install it?](#how-do-i-install-it)
* [How do I read a JSON file?](#how-do-i-read-a-json-file)
* [How do I parse a stream of JSON?](#how-do-i-parse-a-stream-of-json)
* [How do I selectively parse individual items from a JSON stream?](#how-do-i-selectively-parse-individual-items-from-a-json-stream)
* [How do I write a JSON file?](#how-do-i-write-a-json-file)
* [How do I create a stream of JSON?](#how-do-i-create-a-stream-of-json)
* [How do I create a JSON string?](#how-do-i-create-a-json-string)
* [What other methods are there?](#what-other-methods-are-there)
  * [bfj.walk (stream, options)](#bfjwalk-stream-options)
  * [bfj.eventify (data, options)](#bfjeventify-data-options)
* [What options can I specify?](#what-options-can-i-specify)
  * [Options for parsing functions](#options-for-parsing-functions)
  * [Options for serialisation functions](#options-for-serialisation-functions)
* [Is it possible to pause parsing or serialisation from calling code?](#is-it-possible-to-pause-parsing-or-serialisation-from-calling-code)
* [Can it handle newline-delimited JSON (NDJSON)?](#can-it-handle-newline-delimited-json-ndjson)
* [Why does it default to bluebird promises?](#why-does-it-default-to-bluebird-promises)
* [Can I specify a different promise implementation?](#can-i-specify-a-different-promise-implementation)
* [Is there a change log?](#is-there-a-change-log)
* [How do I set up the dev environment?](#how-do-i-set-up-the-dev-environment)
* [What versions of Node.js does it support?](#what-versions-of-nodejs-does-it-support)
* [What license is it released under?](#what-license-is-it-released-under)

## Why would I want those?

If you need
to parse huge JSON strings
or stringify huge JavaScript data sets,
it monopolises the event loop
and can lead to out-of-memory exceptions.
BFJ implements asynchronous functions
and uses pre-allocated fixed-length arrays
to try and alleviate those issues.

## Is it fast?

No.

BFJ yields frequently
to avoid monopolising the event loop,
interrupting its own execution
to let other event handlers run.
The frequency of those yields
can be controlled with the [`yieldRate` option](#what-options-can-i-specify),
but fundamentally it is not designed for speed.

Furthermore,
when serialising data to a stream,
BFJ uses a fixed-length buffer
to avoid exhausting available memory.
Whenever that buffer is full,
serialisation is paused
until the receiving stream processes some more data,
regardless of the value of `yieldRate`.
You can control the size of the buffer
using the [`bufferLength` option](#options-for-serialisation-functions)
but really,
if you need quick results,
BFJ is not for you.

## What functions does it implement?

Nine functions
are exported.

Five are
concerned with
parsing, or
turning JSON strings
into JavaScript data:

* [`read`](#how-do-i-read-a-json-file)
  asynchronously parses
  a JSON file from disk.

* [`parse` and `unpipe`](#how-do-i-parse-a-stream-of-json)
  are for asynchronously parsing
  streams of JSON.

* [`match`](#how-do-i-selectively-parse-individual-items-from-a-json-stream)
  selectively parses individual items
  from a JSON stream.

* [`walk`](#bfjwalk-stream-options)
  asynchronously walks
  a stream,
  emitting events
  as it encounters
  JSON tokens.
  Analagous to a
  [SAX parser][sax].

The other four functions
handle the reverse transformations,
serialising
JavaScript data
to JSON:

* [`write`](#how-do-i-write-a-json-file)
  asynchronously serialises data
  to a JSON file on disk.

* [`streamify`](#how-do-i-create-a-stream-of-json)
  asynchronously serialises data
  to a stream of JSON.

* [`stringify`](#how-do-i-create-a-json-string)
  asynchronously serialises data
  to a JSON string.

* [`eventify`](#bfjeventify-data-options)
  asynchronously traverses
  a data structure
  depth-first,
  emitting events
  as it encounters items.
  By default
  it coerces
  promises, buffers and iterables
  to JSON-friendly values.

## How do I install it?

If you're using npm:

```
npm i bfj --save
```

Or if you just want
the git repo:

```
git clone git@gitlab.com:philbooth/bfj.git
```

## How do I read a JSON file?

```js
const bfj = require('bfj');

bfj.read(path, options)
  .then(data => {
    // :)
  })
  .catch(error => {
    // :(
  });
```

`read` returns a [bluebird promise][promise] and
asynchronously parses
a JSON file
from disk.

It takes two arguments;
the path to the JSON file
and an [options](#options-for-parsing-functions) object.

If there are
no syntax errors,
the returned promise is resolved
with the parsed data.
If syntax errors occur,
the promise is rejected
with the first error.

## How do I parse a stream of JSON?

```js
const bfj = require('bfj');

// By passing a readable stream to bfj.parse():
bfj.parse(fs.createReadStream(path), options)
  .then(data => {
    // :)
  })
  .catch(error => {
    // :(
  });

// ...or by passing the result from bfj.unpipe() to stream.pipe():
request({ url }).pipe(bfj.unpipe((error, data) => {
  if (error) {
    // :(
  } else {
    // :)
  }
}))
```

* `parse` returns a [bluebird promise][promise]
  and asynchronously parses
  a stream of JSON data.

  It takes two arguments;
  a [readable stream][readable]
  from which
  the JSON
  will be parsed
  and an [options](#options-for-parsing-functions) object.

  If there are
  no syntax errors,
  the returned promise is resolved
  with the parsed data.
  If syntax errors occur,
  the promise is rejected
  with the first error.

* `unpipe` returns a [writable stream][writable]
  that can be passed to [`stream.pipe`][pipe],
  then parses JSON data
  read from the stream.

  It takes two arguments;
  a callback function
  that will be called
  after parsing is complete
  and an [options](#options-for-parsing-functions) object.

  If there are no errors,
  the callback is invoked
  with the result as the second argument.
  If errors occur,
  the first error is passed
  the callback
  as the first argument.

## How do I selectively parse individual items from a JSON stream?

```js
const bfj = require('bfj');

// Call match with your stream and a selector predicate/regex/string
const dataStream = bfj.match(jsonStream, selector, options);

// Get data out of the returned stream with event handlers
dataStream.on('data', item => { /* ... */ });
dataStream.on('end', () => { /* ... */);
dataStream.on('error', () => { /* ... */);
dataStream.on('dataError', () => { /* ... */);

// ...or you can pipe it to another stream
dataStream.pipe(someOtherStream);
```

`match` returns a readable, object-mode stream
and asynchronously parses individual matching items
from an input JSON stream.

It takes three arguments:
a [readable stream][readable]
from which the JSON will be parsed;
a selector argument for determining matches,
which may be a string, a regular expression or a predicate function;
and an [options](#options-for-parsing-functions) object.

If the selector is a string,
it will be compared to property keys
to determine whether
each item in the data is a match.
If it is a regular expression,
the comparison will be made
by calling the [RegExp `test` method][regexp-test]
with the property key.
Predicate functions will be called with three arguments:
`key`, `value` and `depth`.
If the result of the predicate is a truthy value
then the item will be deemed a match.

If there are any syntax errors in the JSON,
a `dataError` event will be emitted.
If any other errors occur,
an `error` event will be emitted.

## How do I write a JSON file?

```js
const bfj = require('bfj');

bfj.write(path, data, options)
  .then(() => {
    // :)
  })
  .catch(error => {
    // :(
  });
```

`write` returns a [bluebird promise][promise]
and asynchronously serialises a data structure
to a JSON file on disk.
The promise is resolved
when the file has been written,
or rejected with the error
if writing failed.

It takes three arguments;
the path to the JSON file,
the data structure to serialise
and an [options](#options-for-serialisation-functions) object.

## How do I create a stream of JSON?

```js
const bfj = require('bfj');

const stream = bfj.streamify(data, options);

// Get data out of the stream with event handlers
stream.on('data', chunk => { /* ... */ });
stream.on('end', () => { /* ... */);
stream.on('error', () => { /* ... */);
stream.on('dataError', () => { /* ... */);

// ...or you can pipe it to another stream
stream.pipe(someOtherStream);
```

`streamify` returns a [readable stream][readable]
and asynchronously serialises
a data structure to JSON,
pushing the result
to the returned stream.

It takes two arguments;
the data structure to serialise
and an [options](#options-for-serialisation-functions) object.

If there a circular reference is encountered in the data
and `options.circular` is not set to `'ignore'`,
a `dataError` event will be emitted.
If any other errors occur,
an `error` event will be emitted.

## How do I create a JSON string?

```js
const bfj = require('bfj');

bfj.stringify(data, options)
  .then(json => {
    // :)
  })
  .catch(error => {
    // :(
  });
```

`stringify` returns a [bluebird promise][promise] and
asynchronously serialises a data structure
to a JSON string.
The promise is resolved
to the JSON string
when serialisation is complete.

It takes two arguments;
the data structure to serialise
and an [options](#options-for-serialisation-functions) object.

## What other methods are there?

### bfj.walk (stream, options)

```js
const bfj = require('bfj');

const emitter = bfj.walk(fs.createReadStream(path), options);

emitter.on(bfj.events.array, () => { /* ... */ });
emitter.on(bfj.events.object, () => { /* ... */ });
emitter.on(bfj.events.property, name => { /* ... */ });
emitter.on(bfj.events.string, value => { /* ... */ });
emitter.on(bfj.events.number, value => { /* ... */ });
emitter.on(bfj.events.literal, value => { /* ... */ });
emitter.on(bfj.events.endArray, () => { /* ... */ });
emitter.on(bfj.events.endObject, () => { /* ... */ });
emitter.on(bfj.events.error, error => { /* ... */ });
emitter.on(bfj.events.dataError, error => { /* ... */ });
emitter.on(bfj.events.end, () => { /* ... */ });
```

`walk` returns an [event emitter][eventemitter]
and asynchronously walks
a stream of JSON data,
emitting events
as it encounters
tokens.

It takes two arguments;
a [readable stream][readable]
from which
the JSON
will be read
and an [options](#options-for-parsing-functions) object.

The emitted events
are defined
as public properties
of an object,
`bfj.events`:

* `bfj.events.array`
  indicates that
  an array context
  has been entered
  by encountering
  the `[` character.

* `bfj.events.endArray`
  indicates that
  an array context
  has been left
  by encountering
  the `]` character.

* `bfj.events.object`
  indicates that
  an object context
  has been entered
  by encountering
  the `{` character.

* `bfj.events.endObject`
  indicates that
  an object context
  has been left
  by encountering
  the `}` character.

* `bfj.events.property`
  indicates that
  a property
  has been encountered
  in an object.
  The listener
  will be passed
  the name of the property
  as its argument
  and the next event
  to be emitted
  will represent
  the property's value.

* `bfj.events.string`
  indicates that
  a string
  has been encountered.
  The listener
  will be passed
  the value
  as its argument.

* `bfj.events.number`
  indicates that
  a number
  has been encountered.
  The listener
  will be passed
  the value
  as its argument.

* `bfj.events.literal`
  indicates that
  a JSON literal
  (either `true`, `false` or `null`)
  has been encountered.
  The listener
  will be passed
  the value
  as its argument.

* `bfj.events.error`
  indicates that
  an error was caught
  from one of the event handlers
  in user code.
  The listener
  will be passed
  the `Error` instance
  as its argument.

* `bfj.events.dataError`
  indicates that
  a syntax error was encountered
  in the incoming JSON stream.
  The listener
  will be passed
  an `Error` instance
  decorated with `actual`, `expected`, `lineNumber` and `columnNumber` properties
  as its argument.

* `bfj.events.end`
  indicates that
  the end of the input
  has been reached
  and the stream is closed.

* `bfj.events.endLine`
  indicates that a root-level newline character
  has been encountered in an [NDJSON](#can-it-handle-newline-delimited-json-ndjson) stream.
  Only emitted if the `ndjson` [option](#options-for-parsing-functions) is set.

If you are using `bfj.walk`
to sequentially parse items in an array,
you might also be interested in
the [bfj-collections] module.

### bfj.eventify (data, options)

```js
const bfj = require('bfj');

const emitter = bfj.eventify(data, options);

emitter.on(bfj.events.array, () => { /* ... */ });
emitter.on(bfj.events.object, () => { /* ... */ });
emitter.on(bfj.events.property, name => { /* ... */ });
emitter.on(bfj.events.string, value => { /* ... */ });
emitter.on(bfj.events.number, value => { /* ... */ });
emitter.on(bfj.events.literal, value => { /* ... */ });
emitter.on(bfj.events.endArray, () => { /* ... */ });
emitter.on(bfj.events.endObject, () => { /* ... */ });
emitter.on(bfj.events.error, error => { /* ... */ });
emitter.on(bfj.events.dataError, error => { /* ... */ });
emitter.on(bfj.events.end, () => { /* ... */ });
```

`eventify` returns an [event emitter][eventemitter]
and asynchronously traverses
a data structure depth-first,
emitting events as it
encounters items.
By default it coerces
promises, buffers and iterables
to JSON-friendly values.

It takes two arguments;
the data structure to traverse
and an [options](#options-for-serialisation-functions) object.

The emitted events
are defined
as public properties
of an object,
`bfj.events`:

* `bfj.events.array`
  indicates that
  an array
  has been encountered.

* `bfj.events.endArray`
  indicates that
  the end of an array
  has been encountered.

* `bfj.events.object`
  indicates that
  an object
  has been encountered.

* `bfj.events.endObject`
  indicates that
  the end of an object
  has been encountered.

* `bfj.events.property`
  indicates that
  a property
  has been encountered
  in an object.
  The listener
  will be passed
  the name of the property
  as its argument
  and the next event
  to be emitted
  will represent
  the property's value.

* `bfj.events.string`
  indicates that
  a string
  has been encountered.
  The listener
  will be passed
  the value
  as its argument.

* `bfj.events.number`
  indicates that
  a number
  has been encountered.
  The listener
  will be passed
  the value
  as its argument.

* `bfj.events.literal`
  indicates that
  a JSON literal
  (either `true`, `false` or `null`)
  has been encountered.
  The listener
  will be passed
  the value
  as its argument.

* `bfj.events.error`
  indicates that
  an error was caught
  from one of the event handlers
  in user code.
  The listener
  will be passed
  the `Error` instance
  as its argument.

* `bfj.events.dataError`
  indicates that
  a circular reference was encountered in the data
  and the `circular` option was not set to `'ignore'`.
  The listener
  will be passed
  an `Error` instance
  as its argument.

* `bfj.events.end`
  indicates that
  the end of the data
  has been reached and
  no further events
  will be emitted.

## What options can I specify?

### Options for parsing functions

* `options.reviver`:
  Transformation function,
  invoked depth-first
  against the parsed
  data structure.
  This option
  is analagous to the
  [reviver parameter for JSON.parse][reviver].

* `options.yieldRate`:
  The number of data items to process
  before yielding to the event loop.
  Smaller values yield to the event loop more frequently,
  meaning less time will be consumed by bfj per tick
  but the overall parsing time will be slower.
  Larger values yield to the event loop less often,
  meaning slower tick times but faster overall parsing time.
  The default value is `16384`.

* `options.Promise`:
  Promise constructor that will be used
  for promises returned by all methods.
  If you set this option,
  please be aware that some promise implementations
  (including native promises)
  may cause your process to die
  with out-of-memory exceptions.
  Defaults to [bluebird's implementation][promise],
  which does not have that problem.

* `options.ndjson`:
  If set to `true`,
  newline characters at the root level
  will be treated as delimiters between
  discrete chunks of JSON.
  See [NDJSON](#can-it-handle-newline-delimited-json-ndjson) for more information.

* `options.numbers`:
  For `bfj.match` only,
  set this to `true`
  if you wish to match against numbers
  with a string or regular expression
  `selector` argument.

* `options.bufferLength`:
  For `bfj.match` only,
  the length of the match buffer.
  Smaller values use less memory
  but may result in a slower parse time.
  The default value is `1024`.

* `options.highWaterMark`:
  For `bfj.match` only,
  set this if you would like to
  pass a value for the `highWaterMark` option
  to the readable stream constructor.

### Options for serialisation functions

* `options.space`:
  Indentation string
  or the number of spaces
  to indent
  each nested level by.
  This option
  is analagous to the
  [space parameter for JSON.stringify][space].

* `options.promises`:
  By default,
  promises are coerced
  to their resolved value.
  Set this property
  to `'ignore'`
  for improved performance
  if you don't need
  to coerce promises.

* `options.buffers`:
  By default,
  buffers are coerced
  using their `toString` method.
  Set this property
  to `'ignore'`
  for improved performance
  if you don't need
  to coerce buffers.

* `options.maps`:
  By default,
  maps are coerced
  to plain objects.
  Set this property
  to `'ignore'`
  for improved performance
  if you don't need
  to coerce maps.

* `options.iterables`:
  By default,
  other iterables
  (i.e. not arrays, strings or maps)
  are coerced
  to arrays.
  Set this property
  to `'ignore'`
  for improved performance
  if you don't need
  to coerce iterables.

* `options.circular`:
  By default,
  circular references
  will cause the write
  to fail.
  Set this property
  to `'ignore'`
  if you'd prefer
  to silently skip past
  circular references
  in the data.

* `options.bufferLength`:
  The length of the write buffer.
  Smaller values use less memory
  but may result in a slower serialisation time.
  The default value is `1024`.

* `options.highWaterMark`:
  Set this if you would like to
  pass a value for the `highWaterMark` option
  to the readable stream constructor.

* `options.yieldRate`:
  The number of data items to process
  before yielding to the event loop.
  Smaller values yield to the event loop more frequently,
  meaning less time will be consumed by bfj per tick
  but the overall serialisation time will be slower.
  Larger values yield to the event loop less often,
  meaning slower tick times but faster overall serialisation time.
  The default value is `16384`.

* `options.Promise`:
  Promise constructor that will be used
  for promises returned by all methods.
  If you set this option,
  please be aware that some promise implementations
  (including native promises)
  may cause your process to die
  with out-of-memory exceptions.
  Defaults to [bluebird's implementation][promise],
  which does not have that problem.

## Is it possible to pause parsing or serialisation from calling code?

Yes it is!
Both [`walk`](#bfjwalk-stream-options)
and [`eventify`](#bfjeventify-data-options)
decorate their returned event emitters
with a `pause` method
that will prevent any further events being emitted.
The `pause` method itself
returns a `resume` function
that you can call to indicate
that processing should continue.

For example:

```js
const bfj = require('bfj');
const emitter = bfj.walk(fs.createReadStream(path), options);

// Later, when you want to pause parsing:

const resume = emitter.pause();

// Then when you want to resume:

resume();
```

## Can it handle [newline-delimited JSON (NDJSON)](http://ndjson.org/)?

Yes.
If you pass the `ndjson` [option](#options-for-parsing-functions)
to `bfj.walk`, `bfj.match` or `bfj.parse`,
newline characters at the root level
will act as delimiters between
discrete JSON values:

* `bfj.walk` will emit a `bfj.events.endLine` event
  each time it encounters a newline character.

* `bfj.match` will just ignore the newlines
  while it continues looking for matching items.

* `bfj.parse` will resolve with the first value
  and pause the underlying stream.
  If it's called again with the same stream,
  it will resume processing
  and resolve with the second value.
  To parse the entire stream,
  calls should be made sequentially one-at-a-time
  until the returned promise
  resolves to `undefined`
  (`undefined` is not a valid JSON token).

`bfj.unpipe` and `bfj.read` will not parse NDJSON.

## Why does it default to bluebird promises?

Until version `4.2.4`,
native promises were used.
But they were found
to cause out-of-memory errors
when serialising large amounts of data to JSON,
due to [well-documented problems
with the native promise implementation](https://alexn.org/blog/2017/10/11/javascript-promise-leaks-memory.html).
So in version `5.0.0`,
bluebird promises were used instead.
In version `5.1.0`,
an option was added
that enables callers to specify
the promise constructor to use.
Use it at your own risk.

## Can I specify a different promise implementation?

Yes.
Just pass the `Promise` option
to any method.
If you get out-of-memory errors
when using that option,
consider changing your promise implementation.

## Is there a change log?

[Yes][history].

## How do I set up the dev environment?

The development environment
relies on [Node.js][node],
[ESLint],
[Mocha],
[Chai],
[Proxyquire] and
[Spooks].
Assuming that
you already have
node and NPM
set up,
you just need
to run
`npm install`
to install
all of the dependencies
as listed in `package.json`.

You can
lint the code
with the command
`npm run lint`.

You can
run the tests
with the command
`npm test`.

## What versions of Node.js does it support?

As of [version `3.0.0`](HISTORY.md#300),
only Node.js versions 6 or greater
are supported
because of the dependency
on [Hoopy](https://gitlab.com/philbooth/hoopy).
Previous versions supported
node 4 and later.

A separate `node-4` branch was maintained
until version `5.4.1`,
which had feature parity version-for-version
with releases from `master`.
Releases from the `node-4` branch
are available in npm
under the package name [`bfj-node4`](https://www.npmjs.com/package/bfj-node4).

## What license is it released under?

[MIT][license].

[ci-image]: https://secure.travis-ci.org/philbooth/bfj.png?branch=master
[ci-status]: http://travis-ci.org/#!/philbooth/bfj
[sax]: http://en.wikipedia.org/wiki/Simple_API_for_XML
[promise]: http://bluebirdjs.com/docs/api-reference.html
[bfj-collections]: https://github.com/hash-bang/bfj-collections
[eventemitter]: https://nodejs.org/api/events.html#events_class_eventemitter
[readable]: https://nodejs.org/api/stream.html#stream_readable_streams
[writable]: https://nodejs.org/api/stream.html#stream_writable_streams
[pipe]: https://nodejs.org/api/stream.html#stream_readable_pipe_destination_options
[regexp-test]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/RegExp/test
[reviver]: https://developer.mozilla.org/en/docs/Web/JavaScript/Reference/Global_Objects/JSON/parse#Using_the_reviver_parameter
[space]: https://developer.mozilla.org/en/docs/Web/JavaScript/Reference/Global_Objects/JSON/stringify#The_space_argument
[history]: HISTORY.md
[node]: https://nodejs.org/en/
[eslint]: http://eslint.org/
[mocha]: https://mochajs.org/
[chai]: http://chaijs.com/
[proxyquire]: https://github.com/thlorenz/proxyquire
[spooks]: https://gitlab.com/philbooth/spooks.js
[license]: COPYING
