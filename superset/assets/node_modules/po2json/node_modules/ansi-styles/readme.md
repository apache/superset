# ansi-styles [![Build Status](https://secure.travis-ci.org/sindresorhus/ansi-styles.png?branch=master)](http://travis-ci.org/sindresorhus/ansi-styles)

> [ANSI escape codes](http://en.wikipedia.org/wiki/ANSI_escape_code#Colors_and_Styles) for colorizing strings in the terminal.

You probably want the higher-level [chalk](https://github.com/sindresorhus/chalk) module for styling your strings.

![screenshot](screenshot.png)


## Install

Install with [npm](https://npmjs.org/package/ansi-styles): `npm install --save ansi-styles`


## Example

```js
var ansi = require('ansi-styles');

console.log(ansi.green.open + 'Hello world!' + ansi.green.close);
```

## API

Each style has an `open` and `close` property.


## Styles

### General

- reset
- bold
- italic
- underline
- inverse
- strikethrough

### Text colors

- black
- red
- green
- yellow
- blue
- magenta
- cyan
- white
- gray

### Background colors

- bgBlack
- bgRed
- bgGreen
- bgYellow
- bgBlue
- bgMagenta
- bgCyan
- bgWhite


## License

MIT © [Sindre Sorhus](http://sindresorhus.com)
