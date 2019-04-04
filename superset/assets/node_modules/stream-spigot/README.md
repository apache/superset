Stream Spigot
=============

A generator for (streams2) Readable streams, useful for testing or converting simple lazy functions into Readable streams.

```
npm install stream-spigot
```

Examples:

```javascript
var spigot = require("stream-spigot")

spigot(["ABCDEFG"]).pipe(process.stdout)
// ABCDEFG

spigot(["ABC", "DEF", "G"]).pipe(process.stdout)
// ABCDEFG

var count = 0
function gen() {
  if (count++ < 5) {
    return {val: count}
  }
}

spigot({objectMode: true}, gen).pipe(...)
/*
{val: 1}
{val: 2}
{val: 3}
{val: 4}
{val: 5}
*/

// Do it asynchronously: (next expects fn(err, data))
function get(next) {
  some_async_op(/*..*/, next)
}
spigot(get).pipe(...)

```

Usage
=====

```javascript
var spigot = require("stream-spigot")

var stream = spigot(some_function)
// or
var stream = spigot(array)
// or
var stream = spigot({objectMode: true}, )
```


spigot([options,] fn)
----------

Until I settle on a better API, spigot will sniff the arity of the generator function you pass it. If your function expects no arguments, it will call it synchronously and buffer each reply as a chunk. Return null to end the stream.

If the generator function expects a single argument, it expects it to be asynchronous. It will call your function like so: `generator(next)` where it proivides `next` as a callback expecting to be called like `next(err, data)`. If an error is encountered, spigot will emit an "error" event with your error. If there is no error, data will be buffered into the stream. The stream will be ended if data is ever null.

spigot([options,] array)
------------------------

The spigot will consecutively write each element from the specified array as a buffered chunk until the array has been consumed. If the array contains contents other than Strings or Buffers, you should consider using `{objectMode: true}` to create this as an objectMode stream.

If your array contains a `null` value, the stream will end at that value instead of consuming the entire array.

Sending an array is equivalent to doing the following:

```javascript
var a = ["my", "array"]
function fn() {
  return a.shift()
}

var stream = spigot(fn)
// will be equivalent to
var stream = spigot(a)
```

Options
-------

Accepts standard [readable-stream](http://npmjs.org/api/stream.html) options.

LICENSE
=======

MIT
