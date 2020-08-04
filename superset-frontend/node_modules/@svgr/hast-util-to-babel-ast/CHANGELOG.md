# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

# [5.4.0](https://github.com/gregberge/svgr/tree/master/packages/hast-util-to-babel-ast/compare/v5.3.1...v5.4.0) (2020-04-27)

**Note:** Version bump only for package @svgr/hast-util-to-babel-ast





## [5.0.1](https://github.com/gregberge/svgr/tree/master/packages/hast-util-to-babel-ast/compare/v5.0.0...v5.0.1) (2019-12-29)


### Bug Fixes

* fix engines in package.json ([a45d6fc](https://github.com/gregberge/svgr/tree/master/packages/hast-util-to-babel-ast/commit/a45d6fc8b43402bec60ed4e9273f90fdc65a23a7))





## [4.3.2](https://github.com/gregberge/svgr/tree/master/packages/hast-util-to-babel-ast/compare/v4.3.1...v4.3.2) (2019-07-15)


### Performance Improvements

* replace rehype with svg-parser ([#321](https://github.com/gregberge/svgr/tree/master/packages/hast-util-to-babel-ast/issues/321)) ([7eb5ef6](https://github.com/gregberge/svgr/tree/master/packages/hast-util-to-babel-ast/commit/7eb5ef6))





## [4.3.1](https://github.com/gregberge/svgr/tree/master/packages/hast-util-to-babel-ast/compare/v4.3.0...v4.3.1) (2019-07-01)

**Note:** Version bump only for package @svgr/hast-util-to-babel-ast





# [4.2.0](https://github.com/gregberge/svgr/tree/master/packages/hast-util-to-babel-ast/compare/v4.1.0...v4.2.0) (2019-04-11)


### Bug Fixes

* **hast-util-to-babel-ast:** correctly handle aria attributes ([23d12aa](https://github.com/gregberge/svgr/tree/master/packages/hast-util-to-babel-ast/commit/23d12aa)), closes [#279](https://github.com/gregberge/svgr/tree/master/packages/hast-util-to-babel-ast/issues/279)





# [4.1.0](https://github.com/gregberge/svgr/compare/v4.0.4...v4.1.0) (2018-11-24)

**Note:** Version bump only for package @svgr/hast-util-to-babel-ast





## [4.0.3](https://github.com/gregberge/svgr/compare/v4.0.2...v4.0.3) (2018-11-13)


### Bug Fixes

* upgrade dependencies ([7e2195f](https://github.com/gregberge/svgr/commit/7e2195f))





## [4.0.2](https://github.com/gregberge/svgr/compare/v4.0.1...v4.0.2) (2018-11-08)


### Bug Fixes

* **hast-util-to-babel-ast:** replace tabs by spaces in attributes ([b0f3d19](https://github.com/gregberge/svgr/commit/b0f3d19)), closes [#219](https://github.com/gregberge/svgr/issues/219)





## [4.0.1](https://github.com/gregberge/svgr/compare/v4.0.0...v4.0.1) (2018-11-08)


### Bug Fixes

* **hast-util-to-babel-ast:** correctly transforms data & aria attributes ([99711c4](https://github.com/gregberge/svgr/commit/99711c4)), closes [#221](https://github.com/gregberge/svgr/issues/221)
* **hast-util-to-babel-ast:** replace line-breaks in attributes ([00a2625](https://github.com/gregberge/svgr/commit/00a2625)), closes [#219](https://github.com/gregberge/svgr/issues/219)





# [4.0.0](https://github.com/gregberge/svgr/compare/v3.1.0...v4.0.0) (2018-11-04)


### Features

* **v4:** new architecture ([ac8b8ca](https://github.com/gregberge/svgr/commit/ac8b8ca))


### BREAKING CHANGES

* **v4:** - `template` option must now returns a Babel AST
- `@svgr/core` does not include svgo & prettier by default
