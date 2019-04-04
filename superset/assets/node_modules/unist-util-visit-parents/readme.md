# unist-util-visit-parents [![Build Status][build-badge]][build-page] [![Coverage Status][coverage-badge]][coverage-page]

[Unist][] node visitor, with ancestral information.

## Installation

[npm][]:

```bash
npm install unist-util-visit-parents
```

## Usage

```javascript
var remark = require('remark')
var visit = require('unist-util-visit-parents')

var tree = remark.parse('Some _emphasis_, **importance**, and `code`.')

visit(tree, 'strong', visitor)

function visitor(node, parents) {
  console.log(parents)
}
```

Yields:

```js
[ { type: 'root', children: [ [Object] ] },
  { type: 'paragraph',
    children:
     [ [Object],
       [Object],
       [Object],
       [Object],
       [Object],
       [Object],
       [Object] ] } ]
```

## API

### `visit(node[, type], visitor)`

Visit nodes, with ancestral information.  Optionally by node type.

###### Parameters

*   `node` ([`Node`][node]) — Node to search
*   `type` (`string`, optional) — Node type
*   `visitor` ([Function][visitor]) — Visitor invoked when a node is found

#### `stop? = visitor(node, parents)`

Invoked when a node (when `type` is given, matching `type`) is found.

###### Parameters

*   `node` ([`Node`][node]) — Found node
*   `parents` (`Array.<Node>`) — List of parents

###### Returns

`boolean?` - When `false`, visiting is immediately stopped.

## Related

*   [`unist-util-visit`](https://github.com/syntax-tree/unist-util-visit)
    — Like `visit-parents`, but with one parent
*   [`unist-util-filter`](https://github.com/eush77/unist-util-filter)
    — Create a new tree with all nodes that pass a test
*   [`unist-util-map`](https://github.com/syntax-tree/unist-util-map)
    — Create a new tree with all nodes mapped by a given function
*   [`unist-util-remove`](https://github.com/eush77/unist-util-remove)
    — Remove nodes from a tree that pass a test
*   [`unist-util-select`](https://github.com/eush77/unist-util-select)
    — Select nodes with CSS-like selectors

## Contribute

See [`contributing.md` in `syntax-tree/unist`][contributing] for ways to get
started.

This organisation has a [Code of Conduct][coc].  By interacting with this
repository, organisation, or community you agree to abide by its terms.

## License

[MIT][license] © [Titus Wormer][author]

<!-- Definition -->

[build-badge]: https://img.shields.io/travis/syntax-tree/unist-util-visit-parents.svg

[build-page]: https://travis-ci.org/syntax-tree/unist-util-visit-parents

[coverage-badge]: https://img.shields.io/codecov/c/github/syntax-tree/unist-util-visit-parents.svg

[coverage-page]: https://codecov.io/github/syntax-tree/unist-util-visit-parents?branch=master

[npm]: https://docs.npmjs.com/cli/install

[license]: LICENSE

[author]: http://wooorm.com

[unist]: https://github.com/syntax-tree/unist

[node]: https://github.com/syntax-tree/unist#node

[visitor]: #stop--visitornode-parents

[contributing]: https://github.com/syntax-tree/unist/blob/master/contributing.md

[coc]: https://github.com/syntax-tree/unist/blob/master/code-of-conduct.md
