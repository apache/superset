# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## [5.0.1](https://github.com/gregberge/svgr/tree/master/packages/babel-plugin-replace-jsx-attribute-value/compare/v5.0.0...v5.0.1) (2019-12-29)


### Bug Fixes

* fix engines in package.json ([a45d6fc](https://github.com/gregberge/svgr/tree/master/packages/babel-plugin-replace-jsx-attribute-value/commit/a45d6fc8b43402bec60ed4e9273f90fdc65a23a7))





# [4.2.0](https://github.com/gregberge/svgr/tree/master/packages/babel-plugin-replace-jsx-attribute-value/compare/v4.1.0...v4.2.0) (2019-04-11)

**Note:** Version bump only for package @svgr/babel-plugin-replace-jsx-attribute-value





# [4.0.0](https://github.com/gregberge/svgr/compare/v3.1.0...v4.0.0) (2018-11-04)


### Features

* **v4:** new architecture ([ac8b8ca](https://github.com/gregberge/svgr/commit/ac8b8ca))
* allow dynamic properties in replaceAttrValues option ([15f55fe](https://github.com/gregberge/svgr/commit/15f55fe)), closes [#205](https://github.com/gregberge/svgr/issues/205)


### BREAKING CHANGES

* **v4:** - `template` option must now returns a Babel AST
- `@svgr/core` does not include svgo & prettier by default
