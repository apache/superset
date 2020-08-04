# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

### [5.1.1](https://github.com/webpack-contrib/copy-webpack-plugin/compare/v5.1.0...v5.1.1) (2019-12-12)


### Bug Fixes

* allow to setup empty array ([#425](https://github.com/webpack-contrib/copy-webpack-plugin/issues/425)) ([3b79595](https://github.com/webpack-contrib/copy-webpack-plugin/commit/3b79595d6ef3527a26588112ad17e3c54e264d5c))

## [5.1.0](https://github.com/webpack-contrib/copy-webpack-plugin/compare/v5.0.5...v5.1.0) (2019-12-09)


### Features

* validate options ([#419](https://github.com/webpack-contrib/copy-webpack-plugin/issues/419)) ([452539a](https://github.com/webpack-contrib/copy-webpack-plugin/commit/452539ad6498583901536e89204d6004a618cb4a))


### Bug Fixes

* better to determine when glob is used ([4826e56](https://github.com/webpack-contrib/copy-webpack-plugin/commit/4826e56c9c034113eadd86b46a97ed1254bf3252))

### [5.0.5](https://github.com/webpack-contrib/copy-webpack-plugin/compare/v5.0.4...v5.0.5) (2019-11-06)


### Performance Improvements

* improvements for webpack@5



### [5.0.4](https://github.com/webpack-contrib/copy-webpack-plugin/compare/v5.0.3...v5.0.4) (2019-07-26)


### Bug Fixes

* use posix separator for emitting assets ([#392](https://github.com/webpack-contrib/copy-webpack-plugin/issues/392)) ([7f08be6](https://github.com/webpack-contrib/copy-webpack-plugin/commit/7f08be6))



<a name="5.0.3"></a>
## [5.0.3](https://github.com/webpack-contrib/copy-webpack-plugin/compare/v5.0.2...v5.0.3) (2019-04-24)


### Bug Fixes

* alone `[N]` interpolation in `to` option ([#375](https://github.com/webpack-contrib/copy-webpack-plugin/issues/375)) ([70917b7](https://github.com/webpack-contrib/copy-webpack-plugin/commit/70917b7))



<a name="5.0.2"></a>
## [5.0.2](https://github.com/webpack-contrib/copy-webpack-plugin/compare/v5.0.1...v5.0.2) (2019-03-22)


### Bug Fixes

* add fallback to transform cache directory ([#361](https://github.com/webpack-contrib/copy-webpack-plugin/issues/361)) ([05963eb](https://github.com/webpack-contrib/copy-webpack-plugin/commit/05963eb))
* better determinate template in `to` option ([#363](https://github.com/webpack-contrib/copy-webpack-plugin/issues/363)) ([52f8be6](https://github.com/webpack-contrib/copy-webpack-plugin/commit/52f8be6))
* emit errors instead throw ([#362](https://github.com/webpack-contrib/copy-webpack-plugin/issues/362)) ([3946473](https://github.com/webpack-contrib/copy-webpack-plugin/commit/3946473))
* watch on windows ([#359](https://github.com/webpack-contrib/copy-webpack-plugin/issues/359)) ([eaf4306](https://github.com/webpack-contrib/copy-webpack-plugin/commit/eaf4306))


### Performance Improvements

* avoid extra call `stat` for file ([#365](https://github.com/webpack-contrib/copy-webpack-plugin/issues/365)) ([ae2258f](https://github.com/webpack-contrib/copy-webpack-plugin/commit/ae2258f))



<a name="5.0.1"></a>
## [5.0.1](https://github.com/webpack-contrib/copy-webpack-plugin/compare/v4.6.0...v5.0.1) (2019-03-11)


### Bug Fixes

* respect base of `glob` for context dependencies ([#352](https://github.com/webpack-contrib/copy-webpack-plugin/issues/352)) ([5b407f1](https://github.com/webpack-contrib/copy-webpack-plugin/commit/5b407f1))


<a name="5.0.0"></a>
# [5.0.0](https://github.com/webpack-contrib/copy-webpack-plugin/compare/v4.6.0...v5.0.0) (2019-02-20)


### Bug Fixes

* copy only modified files when you use patterns with difference `to` and same `context` ([#341](https://github.com/webpack-contrib/copy-webpack-plugin/issues/341)) ([e808aa2](https://github.com/webpack-contrib/copy-webpack-plugin/commit/e808aa2))
* handle `[contenthash]` as template ([#328](https://github.com/webpack-contrib/copy-webpack-plugin/issues/328)) ([61dfe52](https://github.com/webpack-contrib/copy-webpack-plugin/commit/61dfe52))
* handles when you add new files in watch mode and use `glob` ([#333](https://github.com/webpack-contrib/copy-webpack-plugin/issues/333)) ([49a28f0](https://github.com/webpack-contrib/copy-webpack-plugin/commit/49a28f0))
* normalize path segment separation, no problems when you mixed `/` and `\\` ([#339](https://github.com/webpack-contrib/copy-webpack-plugin/issues/339)) ([8f5e638](https://github.com/webpack-contrib/copy-webpack-plugin/commit/8f5e638))
* throw error if `from` is an empty string [#278](https://github.com/webpack-contrib/copy-webpack-plugin/issues/278) ([#285](https://github.com/webpack-contrib/copy-webpack-plugin/issues/285)) ([adf1046](https://github.com/webpack-contrib/copy-webpack-plugin/commit/adf1046))


### Features

* emit warning instead error if file doesn't exist ([#338](https://github.com/webpack-contrib/copy-webpack-plugin/issues/338)) ([a1c5372](https://github.com/webpack-contrib/copy-webpack-plugin/commit/a1c5372))
* supports copy nested directories/files in symlink ([#335](https://github.com/webpack-contrib/copy-webpack-plugin/issues/335)) ([f551c0d](https://github.com/webpack-contrib/copy-webpack-plugin/commit/f551c0d))


### BREAKING CHANGES

* drop support for webpack < 4
* drop support for node < 6.9
* `debug` option was renamed to `logLevel`, it only accepts string values: `trace`, `debug`, `info`, `warn`, `error` and `silent`
* plugin emit warning instead error if file doesn't exist
* change `prototype` of plugin, now you can to get correct plugin name



<a name="4.6.0"></a>
# [4.6.0](https://github.com/webpack-contrib/copy-webpack-plugin/compare/v4.5.4...v4.6.0) (2018-10-31)


### Bug Fixes

* handle undefined and null as stats value ([#302](https://github.com/webpack-contrib/copy-webpack-plugin/issues/302)) ([78c5d12](https://github.com/webpack-contrib/copy-webpack-plugin/commit/78c5d12))


### Features

* add support for target path transform ([#284](https://github.com/webpack-contrib/copy-webpack-plugin/issues/284)) ([7fe0c06](https://github.com/webpack-contrib/copy-webpack-plugin/commit/7fe0c06))



<a name="4.5.4"></a>
## [4.5.4](https://github.com/webpack-contrib/copy-webpack-plugin/compare/v4.5.3...v4.5.4) (2018-10-18)


### Bug Fixes

* **processPattern:** don't add `'glob'` as directory when it is a file (`contextDependencies`) ([#296](https://github.com/webpack-contrib/copy-webpack-plugin/issues/296)) ([5670926](https://github.com/webpack-contrib/copy-webpack-plugin/commit/5670926))



<a name="4.5.3"></a>
## [4.5.3](https://github.com/webpack-contrib/copy-webpack-plugin/compare/v4.5.2...v4.5.3) (2018-10-10)


### Bug Fixes

* **processPattern:** add `glob` directory context to `contextDependencies` ([#290](https://github.com/webpack-contrib/copy-webpack-plugin/issues/290)) ([5fa69db](https://github.com/webpack-contrib/copy-webpack-plugin/commit/5fa69db))



<a name="4.5.2"></a>
## [4.5.2](https://github.com/webpack-contrib/copy-webpack-plugin/compare/v4.5.1...v4.5.2) (2018-06-26)


### Bug Fixes

* allow square brackets in path ([#264](https://github.com/webpack-contrib/copy-webpack-plugin/issues/264)) ([3ef5b6c](https://github.com/webpack-contrib/copy-webpack-plugin/commit/3ef5b6c)), closes [#231](https://github.com/webpack-contrib/copy-webpack-plugin/issues/231)



<a name="4.5.1"></a>
## [4.5.1](https://github.com/webpack-contrib/copy-webpack-plugin/compare/v4.5.0...v4.5.1) (2018-03-09)


### Bug Fixes

* **package:** update `cacache` v10.0.1...10.0.4 (`dependencies`) ([#238](https://github.com/webpack-contrib/copy-webpack-plugin/issues/238)) ([0b288f9](https://github.com/webpack-contrib/copy-webpack-plugin/commit/0b288f9))


### Performance Improvements

* **index:** switch to `md4` for content hashing ([#239](https://github.com/webpack-contrib/copy-webpack-plugin/issues/239)) ([2be8191](https://github.com/webpack-contrib/copy-webpack-plugin/commit/2be8191))



<a name="4.5.0"></a>
# [4.5.0](https://github.com/webpack-contrib/copy-webpack-plugin/compare/v4.4.3...v4.5.0) (2018-03-02)


### Features

* **processPattern:** add support for `{RegExp)` matches (`pattern.test`) ([#235](https://github.com/webpack-contrib/copy-webpack-plugin/issues/235)) ([1861730](https://github.com/webpack-contrib/copy-webpack-plugin/commit/1861730))



<a name="4.4.3"></a>
## [4.4.3](https://github.com/webpack-contrib/copy-webpack-plugin/compare/v4.4.2...v4.4.3) (2018-03-01)


### Bug Fixes

* **index:** `tapable` deprecation warnings (`webpack >= v4.0.0`) ([#234](https://github.com/webpack-contrib/copy-webpack-plugin/issues/234)) ([445d548](https://github.com/webpack-contrib/copy-webpack-plugin/commit/445d548))



<a name="4.4.2"></a>
## [4.4.2](https://github.com/webpack-contrib/copy-webpack-plugin/compare/v4.4.1...v4.4.2) (2018-02-23)


### Bug Fixes

* **src/:** don't escape non-glob patterns ([#230](https://github.com/webpack-contrib/copy-webpack-plugin/issues/230)) ([0eb2cd5](https://github.com/webpack-contrib/copy-webpack-plugin/commit/0eb2cd5))



<a name="4.4.1"></a>
## [4.4.1](https://github.com/webpack-contrib/copy-webpack-plugin/compare/v4.4.0...v4.4.1) (2018-02-08)


### Bug Fixes

* replace `pify` with simpler promise helpers ([#221](https://github.com/webpack-contrib/copy-webpack-plugin/issues/221)) ([dadac24](https://github.com/webpack-contrib/copy-webpack-plugin/commit/dadac24))



<a name="4.4.0"></a>
# [4.4.0](https://github.com/webpack-contrib/copy-webpack-plugin/compare/v4.3.1...v4.4.0) (2018-02-08)


### Bug Fixes

* **package:** add `prepare` script ([9bf0d99](https://github.com/webpack-contrib/copy-webpack-plugin/commit/9bf0d99))
* **preProcessPatterns:** support glob context paths with special characters ([#208](https://github.com/webpack-contrib/copy-webpack-plugin/issues/208)) ([ea0c05f](https://github.com/webpack-contrib/copy-webpack-plugin/commit/ea0c05f))
* support `webpack >= v4.0.0` ([6a16b3c](https://github.com/webpack-contrib/copy-webpack-plugin/commit/6a16b3c))


### Features

* use `compiler.inputFileSystem` instead `fs` ([#205](https://github.com/webpack-contrib/copy-webpack-plugin/issues/205)) ([158f821](https://github.com/webpack-contrib/copy-webpack-plugin/commit/158f821))



<a name="4.3.1"></a>
## [4.3.1](https://github.com/webpack-contrib/copy-webpack-plugin/compare/v4.3.0...v4.3.1) (2017-12-22)


### Bug Fixes

* `cache` behaviour ([#196](https://github.com/webpack-contrib/copy-webpack-plugin/issues/196)) ([6beb89e](https://github.com/webpack-contrib/copy-webpack-plugin/commit/6beb89e))
* `cache` option behaviour ([3b088d0](https://github.com/webpack-contrib/copy-webpack-plugin/commit/3b088d0))



<a name="4.3.0"></a>
# [4.3.0](https://github.com/webpack-contrib/copy-webpack-plugin/compare/v4.2.4...v4.3.0) (2017-12-14)


### Features

* add option to cache `pattern.transform` (`pattern.cache`) ([#176](https://github.com/webpack-contrib/copy-webpack-plugin/issues/176)) ([20c143b](https://github.com/webpack-contrib/copy-webpack-plugin/commit/20c143b))
* option for caching `transform` function ([48c19ff](https://github.com/webpack-contrib/copy-webpack-plugin/commit/48c19ff))



<a name="4.2.4"></a>
## [4.2.4](https://github.com/webpack-contrib/copy-webpack-plugin/compare/v4.2.3...v4.2.4) (2017-12-14)


### Refactoring

* refactor: use native `{Promise}` instead of `bluebird` ([#178](https://github.com/webpack-contrib/copy-webpack-plugin/issues/178)) ([a508f14](https://github.com/webpack-contrib/copy-webpack-plugin/commit/a508f14))



<a name="4.2.3"></a>
## [4.2.3](https://github.com/webpack-contrib/copy-webpack-plugin/compare/v4.2.2...v4.2.3) (2017-11-23)



<a name="4.2.2"></a>
## [4.2.2](https://github.com/webpack-contrib/copy-webpack-plugin/compare/v4.2.0...v4.2.2) (2017-11-23)


### Bug Fixes

* copying same file to multiple targets ([#165](https://github.com/webpack-contrib/copy-webpack-plugin/issues/165)) ([43a9870](https://github.com/webpack-contrib/copy-webpack-plugin/commit/43a9870))



<a name="4.2.0"></a>
# [4.2.0](https://github.com/webpack-contrib/copy-webpack-plugin/compare/v4.1.1...v4.2.0) (2017-10-19)


### Features

* add `context` option (`options.context`) ([#149](https://github.com/webpack-contrib/copy-webpack-plugin/issues/149)) ([10cd1a2](https://github.com/webpack-contrib/copy-webpack-plugin/commit/10cd1a2))
* allow async transforms ([#111](https://github.com/webpack-contrib/copy-webpack-plugin/issues/111)) ([8794e5f](https://github.com/webpack-contrib/copy-webpack-plugin/commit/8794e5f))
* Plugin context option ([5c54e92](https://github.com/webpack-contrib/copy-webpack-plugin/commit/5c54e92)), closes [#148](https://github.com/webpack-contrib/copy-webpack-plugin/issues/148)
* support `{String}` patterns ([#155](https://github.com/webpack-contrib/copy-webpack-plugin/issues/155)) ([b6c2e66](https://github.com/webpack-contrib/copy-webpack-plugin/commit/b6c2e66))
* Support simple string patterns ([056a60b](https://github.com/webpack-contrib/copy-webpack-plugin/commit/056a60b)), closes [#150](https://github.com/webpack-contrib/copy-webpack-plugin/issues/150)



<a name="4.1.1"></a>
## [4.1.1](https://github.com/webpack-contrib/copy-webpack-plugin/compare/v4.1.0...v4.1.1) (2017-10-05)


### Chore

* Update dependencies for NSP security advisory ([#151](https://github.com/webpack-contrib/copy-webpack-plugin/issues/151)) ([6d4346e](https://github.com/webpack-contrib/copy-webpack-plugin/commit/6d4346e))

  - Reference issue: https://nodesecurity.io/advisories/minimatch_regular-expression-denial-of-service



<a name="4.1.0"></a>
# [4.1.0](https://github.com/webpack-contrib/copy-webpack-plugin/compare/v2.1.3...v4.1.0) (2017-09-29)


### Bug Fixes

* Changed default ignore glob to ignore dot files ([#80](https://github.com/webpack-contrib/copy-webpack-plugin/issues/80)) ([08b69a4](https://github.com/webpack-contrib/copy-webpack-plugin/commit/08b69a4))
* Fixed glob as object ([1b2c21a](https://github.com/webpack-contrib/copy-webpack-plugin/commit/1b2c21a))
* Improved Windows compatibility ([#85](https://github.com/webpack-contrib/copy-webpack-plugin/issues/85)) ([ad62899](https://github.com/webpack-contrib/copy-webpack-plugin/commit/ad62899))
* Memory leak in watch mode and use Set for performance ([#130](https://github.com/webpack-contrib/copy-webpack-plugin/issues/130)) ([de46fde](https://github.com/webpack-contrib/copy-webpack-plugin/commit/de46fde))
* subdirectory errors in blob patterns ([c2720d0](https://github.com/webpack-contrib/copy-webpack-plugin/commit/c2720d0))


### Features

* Added non-wildcard glob support ([405d1ec](https://github.com/webpack-contrib/copy-webpack-plugin/commit/405d1ec))
* Added transform method to patterns ([#77](https://github.com/webpack-contrib/copy-webpack-plugin/issues/77)) ([6371eb1](https://github.com/webpack-contrib/copy-webpack-plugin/commit/6371eb1))



<a name="4.0.1"></a>
## [4.0.1](https://github.com/webpack-contrib/copy-webpack-plugin/compare/v2.1.3...v4.0.1) (2017-09-29)


### Bug Fixes

* Fixed glob as object ([1b2c21a](https://github.com/webpack-contrib/copy-webpack-plugin/commit/1b2c21a))
* Improved Windows compatibility ([#85](https://github.com/webpack-contrib/copy-webpack-plugin/issues/85)) ([ad62899](https://github.com/webpack-contrib/copy-webpack-plugin/commit/ad62899))
* subdirectory errors in blob patterns ([c2720d0](https://github.com/webpack-contrib/copy-webpack-plugin/commit/c2720d0))


### Features

* Added non-wildcard glob support ([405d1ec](https://github.com/webpack-contrib/copy-webpack-plugin/commit/405d1ec))
* Added transform method to patterns ([#77](https://github.com/webpack-contrib/copy-webpack-plugin/issues/77)) ([6371eb1](https://github.com/webpack-contrib/copy-webpack-plugin/commit/6371eb1))



<a name="4.0.0"></a>
## [4.0.0](https://github.com/webpack-contrib/copy-webpack-plugin/compare/v4.0.0...v3.0.1) (2016-10-23)


### Bug Fixes

* Changed default ignore glob to ignore dot files ([#80](https://github.com/webpack-contrib/copy-webpack-plugin/issues/80)) ([08b69a4](https://github.com/webpack-contrib/copy-webpack-plugin/commit/08b69a4))

### Features

* Added transform method to patterns ([6371eb1](https://github.com/webpack-contrib/copy-webpack-plugin/commit/6371eb1))
