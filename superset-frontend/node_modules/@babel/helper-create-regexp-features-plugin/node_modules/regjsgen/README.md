# regjsgen [![Build status][travis-ci-img]][travis-ci] [![Code coverage status][codecov-img]][codecov]

Generate regular expressions from [regjsparser][regjsparser]’s AST.

## Installation

```bash
npm i regjsgen
```

## API

### `regjsgen.generate(ast)`

This function accepts an abstract syntax tree representing a regular expression (see [regjsparser][regjsparser]), and returns the generated regular expression string.

```js
var regjsparser = require('regjsparser');
var regjsgen = require('regjsgen');

// Generate an AST with `regjsparser`.
var ast = regjsparser.parse(regex);

// Modify AST
// …

// Generate `RegExp` string with `regjsgen`.
regex = regjsgen.generate(ast);
```

## Support

Tested in Node.js 0.10, 0.12, 4, 6, 8, 10 and 12.


[travis-ci]: https://travis-ci.org/bnjmnt4n/regjsgen
[travis-ci-img]: https://travis-ci.org/bnjmnt4n/regjsgen.svg?branch=master
[codecov]: https://codecov.io/gh/bnjmnt4n/regjsgen
[codecov-img]: https://codecov.io/gh/bnjmnt4n/regjsgen/branch/master/graph/badge.svg
[regjsparser]: https://github.com/jviereck/regjsparser
