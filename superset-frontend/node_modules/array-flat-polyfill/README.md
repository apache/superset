# Array Flat Polyfill [<img src="http://jonathantneal.github.io/js-logo.svg" alt="" width="90" height="90" align="right">][Array Flat Polyfill]

[![NPM Version][npm-img]][npm-url]
[![Build Status][cli-img]][cli-url]
[![Support Chat][git-img]][git-url]

[Array Flat Polyfill] is a polyfill for `Array.prototype.flat` and
`Array.prototype.flatMap`, following the [TC39 Proposal].

```sh
npm install array-flat-polyfill --save
```

The `flat()` method creates a new array with all sub-array elements
concatenated into it recursively up to the specified depth.

```js
[1, 2, [3, 4, [5, 6]]].flat(2) // [1, 2, 3, 4, 5, 6]
```

The `flatMap()` method maps each element using a mapping function, then
flattens the result into a new array.

```js
[1, 2, 3, 4].flatMap(x => [x * 2]); // [2, 4, 6, 8]
```

The script is 261 bytes when minified and gzipped. It works in all browsers,
going as far back as Internet Explorer 9.

## Usage

For immediate usage, add this script to your document:

```html
<script src="https://unpkg.com/array-flat-polyfill"></script>
```

For Node usage, add [Array Flat Polyfill] to your project:

```sh
npm install array-flat-polyfill
```

Include [Array Flat Polyfill] in your JS:

```js
import 'array-flat-polyfill';
```

[cli-img]: https://img.shields.io/travis/jonathantneal/array-flat-polyfill/master.svg
[cli-url]: https://travis-ci.org/jonathantneal/array-flat-polyfill
[git-img]: https://img.shields.io/badge/support-chat-blue.svg
[git-url]: https://gitter.im/postcss/postcss
[npm-img]: https://img.shields.io/npm/v/array-flat-polyfill.svg
[npm-url]: https://www.npmjs.com/package/array-flat-polyfill

[Array Flat Polyfill]: https://github.com/jonathantneal/array-flat-polyfill
[TC39 Proposal]: https://tc39.github.io/proposal-flatMap/#sec-Array.prototype.flat
