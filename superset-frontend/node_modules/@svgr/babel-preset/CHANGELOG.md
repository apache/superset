# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

# [5.4.0](https://github.com/gregberge/svgr/tree/master/packages/babel-preset/compare/v5.3.1...v5.4.0) (2020-04-27)

**Note:** Version bump only for package @svgr/babel-preset





## [5.3.1](https://github.com/gregberge/svgr/tree/master/packages/babel-preset/compare/v5.3.0...v5.3.1) (2020-04-05)

**Note:** Version bump only for package @svgr/babel-preset





# [5.3.0](https://github.com/gregberge/svgr/tree/master/packages/babel-preset/compare/v5.2.0...v5.3.0) (2020-03-22)

**Note:** Version bump only for package @svgr/babel-preset





# [5.2.0](https://github.com/gregberge/svgr/tree/master/packages/babel-preset/compare/v5.1.0...v5.2.0) (2020-02-23)

**Note:** Version bump only for package @svgr/babel-preset





## [5.0.1](https://github.com/gregberge/svgr/tree/master/packages/babel-preset/compare/v5.0.0...v5.0.1) (2019-12-29)


### Bug Fixes

* fix engines in package.json ([a45d6fc](https://github.com/gregberge/svgr/tree/master/packages/babel-preset/commit/a45d6fc8b43402bec60ed4e9273f90fdc65a23a7))





## [4.3.3](https://github.com/gregberge/svgr/tree/master/packages/babel-preset/compare/v4.3.2...v4.3.3) (2019-09-24)


### Bug Fixes

* **babel-plugin-svg-dynamic-title:** dont render empty title ([#341](https://github.com/gregberge/svgr/tree/master/packages/babel-preset/issues/341)) ([88b24c5](https://github.com/gregberge/svgr/tree/master/packages/babel-preset/commit/88b24c5)), closes [#333](https://github.com/gregberge/svgr/tree/master/packages/babel-preset/issues/333)





## [4.3.1](https://github.com/gregberge/svgr/tree/master/packages/babel-preset/compare/v4.3.0...v4.3.1) (2019-07-01)


### Bug Fixes

* **titleProp:** handle the existing title case by using element instead of value (children) ([#315](https://github.com/gregberge/svgr/tree/master/packages/babel-preset/issues/315)) ([065e7a9](https://github.com/gregberge/svgr/tree/master/packages/babel-preset/commit/065e7a9))





# [4.3.0](https://github.com/gregberge/svgr/tree/master/packages/babel-preset/compare/v4.2.0...v4.3.0) (2019-05-28)


### Features

* titleProps fallbacks to svg's title ([#311](https://github.com/gregberge/svgr/tree/master/packages/babel-preset/issues/311)) ([8f92366](https://github.com/gregberge/svgr/tree/master/packages/babel-preset/commit/8f92366))





# [4.2.0](https://github.com/gregberge/svgr/tree/master/packages/babel-preset/compare/v4.1.0...v4.2.0) (2019-04-11)


### Bug Fixes

* **babel-preset:** expandProps + icon option ([ddfae22](https://github.com/gregberge/svgr/tree/master/packages/babel-preset/commit/ddfae22)), closes [#277](https://github.com/gregberge/svgr/tree/master/packages/babel-preset/issues/277)


### Features

* add expo option ([#289](https://github.com/gregberge/svgr/tree/master/packages/babel-preset/issues/289)) ([978db3e](https://github.com/gregberge/svgr/tree/master/packages/babel-preset/commit/978db3e))





# [4.1.0](https://github.com/gregberge/svgr/compare/v4.0.4...v4.1.0) (2018-11-24)

**Note:** Version bump only for package @svgr/babel-preset





## [4.0.3](https://github.com/gregberge/svgr/compare/v4.0.2...v4.0.3) (2018-11-13)

**Note:** Version bump only for package @svgr/babel-preset





## [4.0.1](https://github.com/gregberge/svgr/compare/v4.0.0...v4.0.1) (2018-11-08)

**Note:** Version bump only for package @svgr/babel-preset





# [4.0.0](https://github.com/gregberge/svgr/compare/v3.1.0...v4.0.0) (2018-11-04)


### Features

* **v4:** new architecture ([ac8b8ca](https://github.com/gregberge/svgr/commit/ac8b8ca))
* allow dynamic properties in replaceAttrValues option ([15f55fe](https://github.com/gregberge/svgr/commit/15f55fe)), closes [#205](https://github.com/gregberge/svgr/issues/205)


### BREAKING CHANGES

* **v4:** - `template` option must now returns a Babel AST
- `@svgr/core` does not include svgo & prettier by default
