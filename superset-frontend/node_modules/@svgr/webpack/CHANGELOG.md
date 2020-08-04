# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

# [5.4.0](https://github.com/gregberge/svgr/tree/master/packages/webpack/compare/v5.3.1...v5.4.0) (2020-04-27)

**Note:** Version bump only for package @svgr/webpack





## [5.3.1](https://github.com/gregberge/svgr/tree/master/packages/webpack/compare/v5.3.0...v5.3.1) (2020-04-05)

**Note:** Version bump only for package @svgr/webpack





# [5.3.0](https://github.com/gregberge/svgr/tree/master/packages/webpack/compare/v5.2.0...v5.3.0) (2020-03-22)

**Note:** Version bump only for package @svgr/webpack





# [5.2.0](https://github.com/gregberge/svgr/tree/master/packages/webpack/compare/v5.1.0...v5.2.0) (2020-02-23)

**Note:** Version bump only for package @svgr/webpack





# [5.1.0](https://github.com/gregberge/svgr/tree/master/packages/webpack/compare/v5.0.1...v5.1.0) (2020-01-20)

**Note:** Version bump only for package @svgr/webpack





## [5.0.1](https://github.com/gregberge/svgr/tree/master/packages/webpack/compare/v5.0.0...v5.0.1) (2019-12-29)


### Bug Fixes

* fix engines in package.json ([a45d6fc](https://github.com/gregberge/svgr/tree/master/packages/webpack/commit/a45d6fc8b43402bec60ed4e9273f90fdc65a23a7))





## [4.3.3](https://github.com/gregberge/svgr/tree/master/packages/webpack/compare/v4.3.2...v4.3.3) (2019-09-24)

**Note:** Version bump only for package @svgr/webpack





## [4.3.2](https://github.com/gregberge/svgr/tree/master/packages/webpack/compare/v4.3.1...v4.3.2) (2019-07-15)

**Note:** Version bump only for package @svgr/webpack





## [4.3.1](https://github.com/gregberge/svgr/tree/master/packages/webpack/compare/v4.3.0...v4.3.1) (2019-07-01)

**Note:** Version bump only for package @svgr/webpack





# [4.3.0](https://github.com/gregberge/svgr/tree/master/packages/webpack/compare/v4.2.0...v4.3.0) (2019-05-28)

**Note:** Version bump only for package @svgr/webpack





# [4.2.0](https://github.com/gregberge/svgr/tree/master/packages/webpack/compare/v4.1.0...v4.2.0) (2019-04-11)

**Note:** Version bump only for package @svgr/webpack





# [4.1.0](https://github.com/gregberge/svgr/compare/v4.0.4...v4.1.0) (2018-11-24)


### Features

* add parcel plugin ([#235](https://github.com/gregberge/svgr/issues/235)) ([144dbe3](https://github.com/gregberge/svgr/commit/144dbe3)), closes [#215](https://github.com/gregberge/svgr/issues/215)





## [4.0.4](https://github.com/gregberge/svgr/compare/v4.0.3...v4.0.4) (2018-11-24)


### Bug Fixes

* **webpack:** use static babel config ([#240](https://github.com/gregberge/svgr/issues/240)) ([d67af31](https://github.com/gregberge/svgr/commit/d67af31)), closes [#232](https://github.com/gregberge/svgr/issues/232)





## [4.0.3](https://github.com/gregberge/svgr/compare/v4.0.2...v4.0.3) (2018-11-13)


### Bug Fixes

* upgrade dependencies ([7e2195f](https://github.com/gregberge/svgr/commit/7e2195f))





## [4.0.2](https://github.com/gregberge/svgr/compare/v4.0.1...v4.0.2) (2018-11-08)

**Note:** Version bump only for package @svgr/webpack





## [4.0.1](https://github.com/gregberge/svgr/compare/v4.0.0...v4.0.1) (2018-11-08)

**Note:** Version bump only for package @svgr/webpack





# [4.0.0](https://github.com/gregberge/svgr/compare/v3.1.0...v4.0.0) (2018-11-04)


### Bug Fixes

* prevent babel read babel.config.js ([#206](https://github.com/gregberge/svgr/issues/206)) ([514d43d](https://github.com/gregberge/svgr/commit/514d43d))


### Features

* **svgo:** prefix ids by default ([06c338d](https://github.com/gregberge/svgr/commit/06c338d)), closes [#210](https://github.com/gregberge/svgr/issues/210)
* **v4:** new architecture ([ac8b8ca](https://github.com/gregberge/svgr/commit/ac8b8ca))


### BREAKING CHANGES

* **v4:** - `template` option must now returns a Babel AST
- `@svgr/core` does not include svgo & prettier by default





# [3.1.0](https://github.com/gregberge/svgr/compare/v3.0.0...v3.1.0) (2018-10-05)

**Note:** Version bump only for package @svgr/webpack





<a name="3.0.0"></a>
# [3.0.0](https://github.com/gregberge/svgr/compare/v2.4.1...v3.0.0) (2018-10-01)


### Bug Fixes

* **webpack:** forward filePath in webpack loader ([b7a108e](https://github.com/gregberge/svgr/commit/b7a108e)), closes [#177](https://github.com/gregberge/svgr/issues/177) [#188](https://github.com/gregberge/svgr/issues/188)


### Features

* always prefix component name with "Svg" ([f71aa7a](https://github.com/gregberge/svgr/commit/f71aa7a)), closes [#190](https://github.com/gregberge/svgr/issues/190)


### BREAKING CHANGES

* **webpack:** runtime configuration is now loaded using webpack
loader.





<a name="2.4.1"></a>
## [2.4.1](https://github.com/gregberge/svgr/compare/v2.4.0...v2.4.1) (2018-09-16)

**Note:** Version bump only for package @svgr/webpack





<a name="2.4.0"></a>
# [2.4.0](https://github.com/gregberge/svgr/compare/v2.3.0...v2.4.0) (2018-09-16)


### Features

* **upgrade:** h2x@1.1.0 (jsdom@12.0.0) & others ([2d9b7bd](https://github.com/gregberge/svgr/commit/2d9b7bd))





<a name="2.3.0"></a>
# [2.3.0](https://github.com/gregberge/svgr/compare/v2.2.1...v2.3.0) (2018-09-03)


### Features

* upgrade to Babel v7 ([7bc908d](https://github.com/gregberge/svgr/commit/7bc908d))





<a name="2.2.1"></a>
## [2.2.1](https://github.com/gregberge/svgr/compare/v2.2.0...v2.2.1) (2018-08-16)

**Note:** Version bump only for package @svgr/webpack





<a name="2.2.0"></a>
# [2.2.0](https://github.com/gregberge/svgr/compare/v2.1.1...v2.2.0) (2018-08-13)


### Bug Fixes

* **webpack:** use source when possible ([#139](https://github.com/gregberge/svgr/issues/139)) ([ae9965d](https://github.com/gregberge/svgr/commit/ae9965d))





<a name="2.1.1"></a>
## [2.1.1](https://github.com/gregberge/svgr/compare/v2.1.0...v2.1.1) (2018-07-11)




**Note:** Version bump only for package @svgr/webpack

<a name="2.1.0"></a>
# [2.1.0](https://github.com/gregberge/svgr/compare/v2.0.0...v2.1.0) (2018-07-08)




**Note:** Version bump only for package @svgr/webpack
