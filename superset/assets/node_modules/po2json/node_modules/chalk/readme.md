# <img width="250" src="logo.png" alt="chalk">

> Terminal string styling done right

[![Build Status](https://secure.travis-ci.org/sindresorhus/chalk.png?branch=master)](http://travis-ci.org/sindresorhus/chalk)

[colors.js](https://github.com/Marak/colors.js) is currently the most popular string styling module, but it has serious deficiencies like extending String.prototype which causes all kinds of [problems](https://github.com/yeoman/yo/issues/68). Although there are other ones, they either do too much or not enough.

**Chalk is a clean and focused alternative.**

![screenshot](screenshot.png)


## Why

- **Doesn't extend String.prototype**
- Expressive API
- Clean and focused
- Auto-detects color support
- Actively maintained
- [Used by 150+ modules](https://npmjs.org/browse/depended/chalk)


## Install

Install with [npm](https://npmjs.org/package/chalk): `npm install --save chalk`


## Example

Chalk comes with an easy to use composable API where you just chain and nest the styles you want.

```js
var chalk = require('chalk');

// style a string
console.log(  chalk.blue('Hello world!')  );

// combine styled and normal strings
console.log(  chalk.blue('Hello'), 'World' + chalk.red('!')  );

// compose multiple styles using the chainable API
console.log(  chalk.blue.bgRed.bold('Hello world!')  );

// nest styles
console.log(  chalk.red('Hello', chalk.underline.bgBlue('world') + '!')  );

// pass in multiple arguments
console.log(  chalk.blue('Hello', 'World!', 'Foo', 'bar', 'biz', 'baz')  );
```

You can easily define your own themes.

```js
var chalk = require('chalk');
var error = chalk.bold.red;
console.log(error('Error!'));
```


## API

### chalk.`<style>[.<style>...](string, [string...])`

Example: `chalk.red.bold.underline('Hello', 'world');`

Chain [styles](#styles) and call the last one as a method with a string argument. Order doesn't matter.

Multiple arguments will be separated by space.

### chalk.enabled

Color support is automatically detected, but you can override it.

### chalk.supportsColor

Detect whether the terminal [supports color](https://github.com/sindresorhus/has-color).

Can be overridden by the user with the flags `--color` and `--no-color`.

Used internally and handled for you, but exposed for convenience.

### chalk.styles

Exposes the styles as [ANSI escape codes](https://github.com/sindresorhus/ansi-styles).

Generally not useful, but you might need just the `.open` or `.close` escape code if you're mixing externally styled strings with yours.

```js
var chalk = require('chalk');

console.log(chalk.styles.red);
//=> {open: '\x1b[31m', close: '\x1b[39m'}

console.log(chalk.styles.red.open + 'Hello' + chalk.styles.red.close);
```

### chalk.stripColor(string)

[Strip color](https://github.com/sindresorhus/strip-ansi) from a string.

Can be useful in combination with `.supportsColor` to strip color on externally styled text when it's not supported.

Example:

```js
var chalk = require('chalk');
var styledString = fromExternal();

if (!chalk.supportsColor) {
	chalk.stripColor(styledString);
}
```


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


-

[![Bitdeli Badge](https://d2weczhvl823v0.cloudfront.net/sindresorhus/chalk/trend.png)](https://bitdeli.com/free "Bitdeli Badge")
