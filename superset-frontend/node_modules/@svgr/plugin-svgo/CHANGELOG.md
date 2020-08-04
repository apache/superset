# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

# [5.4.0](https://github.com/gregberge/svgr/tree/master/packages/plugin-svgo/compare/v5.3.1...v5.4.0) (2020-04-27)

**Note:** Version bump only for package @svgr/plugin-svgo





# [5.3.0](https://github.com/gregberge/svgr/tree/master/packages/plugin-svgo/compare/v5.2.0...v5.3.0) (2020-03-22)


### Bug Fixes

* **svgo:** support any SVGO config format ([#412](https://github.com/gregberge/svgr/tree/master/packages/plugin-svgo/issues/412)) ([f2b2367](https://github.com/gregberge/svgr/tree/master/packages/plugin-svgo/commit/f2b2367389fda20baba6e0a5e884e7f7fe29a3ed)), closes [#400](https://github.com/gregberge/svgr/tree/master/packages/plugin-svgo/issues/400)





# [5.2.0](https://github.com/gregberge/svgr/tree/master/packages/plugin-svgo/compare/v5.1.0...v5.2.0) (2020-02-23)


### Bug Fixes

* verify that `svgoConfig.plugins` is an array ([#397](https://github.com/gregberge/svgr/tree/master/packages/plugin-svgo/issues/397)) ([88110b6](https://github.com/gregberge/svgr/tree/master/packages/plugin-svgo/commit/88110b6eb4d93ded68ca2de05cc82654dfac977d))





# [5.1.0](https://github.com/gregberge/svgr/tree/master/packages/plugin-svgo/compare/v5.0.1...v5.1.0) (2020-01-20)


### Bug Fixes

* fix merging svgo plugins in config ([#384](https://github.com/gregberge/svgr/tree/master/packages/plugin-svgo/issues/384)) ([c9d2dfc](https://github.com/gregberge/svgr/tree/master/packages/plugin-svgo/commit/c9d2dfcb8d4da55eb21a13507c87d9e549a86e7e))





## [5.0.1](https://github.com/gregberge/svgr/tree/master/packages/plugin-svgo/compare/v5.0.0...v5.0.1) (2019-12-29)


### Bug Fixes

* fix engines in package.json ([a45d6fc](https://github.com/gregberge/svgr/tree/master/packages/plugin-svgo/commit/a45d6fc8b43402bec60ed4e9273f90fdc65a23a7))





## [4.3.1](https://github.com/gregberge/svgr/tree/master/packages/plugin-svgo/compare/v4.3.0...v4.3.1) (2019-07-01)

**Note:** Version bump only for package @svgr/plugin-svgo





# [4.2.0](https://github.com/gregberge/svgr/tree/master/packages/plugin-svgo/compare/v4.1.0...v4.2.0) (2019-04-11)


### Bug Fixes

* keep viewBox when dimensions are removed ([#281](https://github.com/gregberge/svgr/tree/master/packages/plugin-svgo/issues/281)) ([f476c8e](https://github.com/gregberge/svgr/tree/master/packages/plugin-svgo/commit/f476c8e))





## [4.0.3](https://github.com/gregberge/svgr/compare/v4.0.2...v4.0.3) (2018-11-13)


### Bug Fixes

* upgrade dependencies ([7e2195f](https://github.com/gregberge/svgr/commit/7e2195f))





# [4.0.0](https://github.com/gregberge/svgr/compare/v3.1.0...v4.0.0) (2018-11-04)


### Features

* **svgo:** prefix ids by default ([06c338d](https://github.com/gregberge/svgr/commit/06c338d)), closes [#210](https://github.com/gregberge/svgr/issues/210)
* **v4:** new architecture ([ac8b8ca](https://github.com/gregberge/svgr/commit/ac8b8ca))


### BREAKING CHANGES

* **v4:** - `template` option must now returns a Babel AST
- `@svgr/core` does not include svgo & prettier by default
