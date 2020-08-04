# @svgr/hast-util-to-babel-ast

[![Build Status](https://img.shields.io/travis/smooth-code/svgr.svg)](https://travis-ci.org/smooth-code/svgr)
[![Version](https://img.shields.io/npm/v/@svgr/hast-util-to-babel-ast.svg)](https://www.npmjs.com/package/@svgr/hast-util-to-babel-ast)
[![MIT License](https://img.shields.io/npm/l/@svgr/hast-util-to-babel-ast.svg)](https://github.com/smooth-code/svgr/blob/master/LICENSE)

Transforms HAST into Babel AST.

## Install

```
npm install --save-dev @svgr/hast-util-to-babel-ast
```

## Usage

```js
import { parse } from 'svg-parser'
import toBabelAST from '@svgr/hast-util-to-babel-ast'

const hastTree = parse(`<svg></svg>`)

const babelTree = hastToBabelAst(hastTree)
```

## License

MIT
