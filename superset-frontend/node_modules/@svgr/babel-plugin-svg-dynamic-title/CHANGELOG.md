# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

# [5.4.0](https://github.com/gregberge/svgr/tree/master/packages/babel-plugin-svg-dynamic-title/compare/v5.3.1...v5.4.0) (2020-04-27)

**Note:** Version bump only for package @svgr/babel-plugin-svg-dynamic-title





## [5.0.1](https://github.com/gregberge/svgr/tree/master/packages/babel-plugin-svg-dynamic-title/compare/v5.0.0...v5.0.1) (2019-12-29)


### Bug Fixes

* fix engines in package.json ([a45d6fc](https://github.com/gregberge/svgr/tree/master/packages/babel-plugin-svg-dynamic-title/commit/a45d6fc8b43402bec60ed4e9273f90fdc65a23a7))





## [4.3.3](https://github.com/gregberge/svgr/tree/master/packages/babel-plugin-svg-dynamic-title/compare/v4.3.2...v4.3.3) (2019-09-24)


### Bug Fixes

* **babel-plugin-svg-dynamic-title:** dont render empty title ([#341](https://github.com/gregberge/svgr/tree/master/packages/babel-plugin-svg-dynamic-title/issues/341)) ([88b24c5](https://github.com/gregberge/svgr/tree/master/packages/babel-plugin-svg-dynamic-title/commit/88b24c5)), closes [#333](https://github.com/gregberge/svgr/tree/master/packages/babel-plugin-svg-dynamic-title/issues/333)





## [4.3.1](https://github.com/gregberge/svgr/tree/master/packages/babel-plugin-svg-dynamic-title/compare/v4.3.0...v4.3.1) (2019-07-01)


### Bug Fixes

* **titleProp:** handle the existing title case by using element instead of value (children) ([#315](https://github.com/gregberge/svgr/tree/master/packages/babel-plugin-svg-dynamic-title/issues/315)) ([065e7a9](https://github.com/gregberge/svgr/tree/master/packages/babel-plugin-svg-dynamic-title/commit/065e7a9))





# [4.3.0](https://github.com/gregberge/svgr/tree/master/packages/babel-plugin-svg-dynamic-title/compare/v4.2.0...v4.3.0) (2019-05-28)


### Features

* titleProps fallbacks to svg's title ([#311](https://github.com/gregberge/svgr/tree/master/packages/babel-plugin-svg-dynamic-title/issues/311)) ([8f92366](https://github.com/gregberge/svgr/tree/master/packages/babel-plugin-svg-dynamic-title/commit/8f92366))





# [4.2.0](https://github.com/gregberge/svgr/tree/master/packages/babel-plugin-svg-dynamic-title/compare/v4.1.0...v4.2.0) (2019-04-11)

**Note:** Version bump only for package @svgr/babel-plugin-svg-dynamic-title





# [4.0.0](https://github.com/gregberge/svgr/compare/v3.1.0...v4.0.0) (2018-11-04)


### Features

* **v4:** new architecture ([ac8b8ca](https://github.com/gregberge/svgr/commit/ac8b8ca))


### BREAKING CHANGES

* **v4:** - `template` option must now returns a Babel AST
- `@svgr/core` does not include svgo & prettier by default
