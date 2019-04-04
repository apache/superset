# strip-ansi [![Build Status](https://secure.travis-ci.org/sindresorhus/strip-ansi.png?branch=master)](http://travis-ci.org/sindresorhus/strip-ansi)

> Strip [ANSI escape codes](http://en.wikipedia.org/wiki/ANSI_escape_code#Colors_and_Styles) (used for colorizing strings in the terminal)

Used in the terminal color module [chalk](https://github.com/sindresorhus/chalk).


## Install

Install locally with [npm](https://npmjs.org/package/strip-ansi):

```
npm install --save strip-ansi
```

Or globally if you want to use it as a CLI app:

```
npm install --global strip-ansi
```

You can then use it in your Terminal like:

```
strip-ansi file-with-color-codes
```

Or pipe something to it:

```
ls | strip-ansi
```


## Example

```js
var stripAnsi = require('strip-ansi');
stripAnsi('\x1b[4mcake\x1b[0m');
//=> cake
```


## License

MIT © [Sindre Sorhus](http://sindresorhus.com)
