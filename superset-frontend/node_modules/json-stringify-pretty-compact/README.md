# json-stringify-pretty-compact [![Build Status][travis-badge]][travis-link]

The output of [JSON.stringify] comes in two flavors: _compact_ and _pretty._ The
former is usually too compact to be read by humans, while the latter sometimes
is too spacious. This module trades performance for a compromise between the
two. The result is a _pretty_ compact string, where “pretty” means both “kind
of” and “nice”.

<!-- prettier-ignore -->
```json
{
  "bool": true,
  "short array": [1, 2, 3],
  "long array": [
    {"x": 1, "y": 2},
    {"x": 2, "y": 1},
    {"x": 1, "y": 1},
    {"x": 2, "y": 2}
  ]
}
```

While the “pretty” mode of [JSON.stringify] puts every item of arrays and
objects on its own line, this module puts the whole array or object on a single
line, unless the line becomes too long (the default maximum is 80 characters).
Making arrays and objects multi-line is the only attempt made to enforce the
maximum line length; if that doesn’t help then so be it.

## Installation

```
npm install json-stringify-pretty-compact
```

```js
const stringify = require("json-stringify-pretty-compact");
```

## `stringify(obj, options = {})`

It’s like `JSON.stringify(obj, options.replacer, options.indent)`, except that
objects and arrays are on one line if they fit (according to
`options.maxLength`).

`options`:

- indent: Defaults to 2. Works exactly like the third parameter of
  [JSON.stringify].
- maxLength: Defaults to 80. Lines will be tried to be kept at maximum this many
  characters long.
- replacer: Defaults to undefined. Works exactly like the second parameter of
  [JSON.stringify].

`stringify(obj, {maxLength: 0, indent: indent})` gives the exact same result as
`JSON.stringify(obj, null, indent)`. (However, if you use a `replacer`, integer
keys might be moved first.)

`stringify(obj, {maxLength: Infinity})` gives the exact same result as
`JSON.stringify(obj)`, except that there are spaces after colons and commas.

**Want more options?** Check out [@aitodotai/json-stringify-pretty-compact]!

## Development

You need Node.js 10 and npm 6.

### npm scripts

- `npm run eslint`: Run [ESLint] \(including [Prettier]).
- `npm run eslint:fix`: Autofix [ESLint] errors.
- `npm run prettier`: Run [Prettier] for files other than JS.
- `npm run jest`: Run unit tests. During development, `npm run jest -- --watch`
  is nice.
- `npm run coverage`: Run unit tests with code coverage.
- `npm test`: Check that everything works.

## License

[MIT](LICENSE).

<!-- prettier-ignore-start -->
[@aitodotai/json-stringify-pretty-compact]: https://www.npmjs.com/package/@aitodotai/json-stringify-pretty-compact
[eslint]: https://eslint.org/
[json.stringify]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/stringify
[prettier]: https://prettier.io/
[travis-badge]: https://travis-ci.org/lydell/json-stringify-pretty-compact.svg?branch=master
[travis-link]: https://travis-ci.org/lydell/json-stringify-pretty-compact
<!-- prettier-ignore-end -->
