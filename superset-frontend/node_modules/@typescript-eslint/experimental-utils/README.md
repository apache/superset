# `@typescript-eslint/experimental-utils`

(Experimental) Utilities for working with TypeScript + ESLint together.

## Note

This package has inherited its version number from the `@typescript-eslint` project.
Meaning that even though this package is `1.x.y`, you shouldn't expect 100% stability between minor version bumps.
i.e. treat it as a `0.x.y` package.

Feel free to use it now, and let us know what utilities you need or send us PRs with utilities you build on top of it.

Once it is stable, it will be renamed to `@typescript-eslint/util` for a `2.0.0` release.

## Exports

| Name                                                                               | Description                                                                                    |
| ---------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| [`TSESTree`](../packages/typescript-estree/src/ts-estree/ts-estree.ts)             | Types for the TypeScript flavor of ESTree created by `@typescript-eslint/typescript-estree`.   |
| [`AST_NODE_TYPES`](../packages/typescript-estree/src/ts-estree/ast-node-types.ts)  | An enum with the names of every single _node_ found in `TSESTree`.                             |
| [`AST_TOKEN_TYPES`](../packages/typescript-estree/src/ts-estree/ast-node-types.ts) | An enum with the names of every single _token_ found in `TSESTree`.                            |
| [`TSESLint`](./src/ts-eslint)                                                      | Types for ESLint, correctly typed to work with the types found in `TSESTree`.                  |
| [`ESLintUtils`](./src/eslint-utils)                                                | Tools for creating ESLint rules with TypeScript.                                               |
| [`ParserServices`](../packages/typescript-estree/src/ts-estree/parser.ts)          | The parser services provided when parsing a file using `@typescript-eslint/typescript-estree`. |

## Contributing

[See the contributing guide here](../../CONTRIBUTING.md)
