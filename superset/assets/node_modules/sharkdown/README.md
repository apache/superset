[![Build Status](https://secure.travis-ci.org/tmcw/sharkdown.png?branch=master)](http://travis-ci.org/tmcw/sharkdown)

# sharkdown

![](https://i.cloudup.com/FdxECDQECh.png)

## usage

    npm install --save sharkdown

Or as a handy utility:

    npm install sharkdown -g

And then you can do:

    sharkdown file.md
    sharkdown < "markdown data"

## api

### `sharkdown(str)`

Takes a string, returns a string with markdown encoded as control codes for a
shell.

### `sharkdown()`

Returns a through-stream for pipes.

## example

```js
var sharkdown = require('sharkdown');

process.stdin
    .pipe(sharkdown())
    .pipe(process.stdout);
```
