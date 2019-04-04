# hast-util-parse-selector

[![Build][build-badge]][build]
[![Coverage][coverage-badge]][coverage]
[![Downloads][downloads-badge]][downloads]
[![Chat][chat-badge]][chat]

Parse a simple CSS selector to a [HAST][] node.

## Installation

[npm][]:

```bash
npm install hast-util-parse-selector
```

## Usage

```javascript
var parseSelector = require('hast-util-parse-selector')

console.log(parseSelector('.quux#bar.baz.qux'))
```

Yields:

```js
{ type: 'element',
  tagName: 'div',
  properties: { id: 'bar', className: [ 'quux', 'baz', 'qux' ] },
  children: [] }
```

## API

### `parseSelector([selector][, defaultTagName])`

Parse a CSS `selector` to a [HAST][] node.

###### `selector`

`string`, optional — Can contain a tag-name (`foo`), classes (`.bar`),
and an ID (`#baz`).  Multiple classes are allowed.  Uses the last ID if
multiple IDs are found.

###### `defaultTagName`

`string`, optional, defaults to `div` — Tag name to use if `selector` does not
specify one.

###### Returns

[`Node`][hast].

## Contribute

See [`contributing.md` in `syntax-tree/hast`][contributing] for ways to get
started.

This organisation has a [Code of Conduct][coc].  By interacting with this
repository, organisation, or community you agree to abide by its terms.

## License

[MIT][license] © [Titus Wormer][author]

<!-- Definitions -->

[build-badge]: https://img.shields.io/travis/syntax-tree/hast-util-parse-selector.svg

[build]: https://travis-ci.org/syntax-tree/hast-util-parse-selector

[coverage-badge]: https://img.shields.io/codecov/c/github/syntax-tree/hast-util-parse-selector.svg

[coverage]: https://codecov.io/github/syntax-tree/hast-util-parse-selector

[downloads-badge]: https://img.shields.io/npm/dm/hast-util-parse-selector.svg

[downloads]: https://www.npmjs.com/package/hast-util-parse-selector

[chat-badge]: https://img.shields.io/badge/join%20the%20community-on%20spectrum-7b16ff.svg

[chat]: https://spectrum.chat/unified/rehype

[npm]: https://docs.npmjs.com/cli/install

[license]: license

[author]: https://wooorm.com

[hast]: https://github.com/syntax-tree/hast

[contributing]: https://github.com/syntax-tree/hast/blob/master/contributing.md

[coc]: https://github.com/syntax-tree/hast/blob/master/code-of-conduct.md
