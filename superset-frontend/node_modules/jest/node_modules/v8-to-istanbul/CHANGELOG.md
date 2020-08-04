# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

### [4.1.3](https://www.github.com/istanbuljs/v8-to-istanbul/compare/v4.1.2...v4.1.3) (2020-03-27)


### Bug Fixes

* handle sourcemap `sources` emtpy edge case ([#94](https://www.github.com/istanbuljs/v8-to-istanbul/issues/94)) ([628af48](https://www.github.com/istanbuljs/v8-to-istanbul/commit/628af48e2f7ab279c52f4355c0ccb92ac16b2c1a))
* v8 coverage ranges that fall on \n characters cause exceptions ([#96](https://www.github.com/istanbuljs/v8-to-istanbul/issues/96)) ([c5731a3](https://www.github.com/istanbuljs/v8-to-istanbul/commit/c5731a3b2fe4dccfae9ee581a5bf7a6e362f5cb8))

### [4.1.2](https://www.github.com/istanbuljs/v8-to-istanbul/compare/v4.1.1...v4.1.2) (2020-02-09)


### Bug Fixes

* protect against undefined sourcesContent ([#89](https://www.github.com/istanbuljs/v8-to-istanbul/issues/89)) ([5b94fe3](https://www.github.com/istanbuljs/v8-to-istanbul/commit/5b94fe37f9b86686386ad01f1fb8a42182f35ad8))

### [4.1.1](https://www.github.com/istanbuljs/v8-to-istanbul/compare/v4.1.0...v4.1.1) (2020-02-07)


### Bug Fixes

* **build:** repository field should have type ([#87](https://www.github.com/istanbuljs/v8-to-istanbul/issues/87)) ([f064542](https://www.github.com/istanbuljs/v8-to-istanbul/commit/f064542844c333d83fc25e0ad7f989f0999f8ceb))

## [4.1.0](https://www.github.com/istanbuljs/v8-to-istanbul/compare/v4.0.1...v4.1.0) (2020-02-06)


### Features

* use the inline source content if available ([#85](https://www.github.com/istanbuljs/v8-to-istanbul/issues/85)) ([1a6d47f](https://www.github.com/istanbuljs/v8-to-istanbul/commit/1a6d47f1412d7c2b072fe794b6bd08bfbf4bbd55))

### [4.0.1](https://www.github.com/istanbuljs/v8-to-istanbul/compare/v4.0.0...v4.0.1) (2019-12-12)


### Bug Fixes

* loosen engine requirement so it can be installed on node 8 ([#82](https://www.github.com/istanbuljs/v8-to-istanbul/issues/82)) ([18f2587](https://www.github.com/istanbuljs/v8-to-istanbul/commit/18f2587481617e4db5ae1565c4f7052a8314af92))

## [4.0.0](https://www.github.com/istanbuljs/v8-to-istanbul/compare/v3.2.6...v4.0.0) (2019-11-23)


### ⚠ BREAKING CHANGES

* paths are now consistently absolute.

### Features

* adds special (empty-report) block ([#74](https://www.github.com/istanbuljs/v8-to-istanbul/issues/74)) ([e981cc1](https://www.github.com/istanbuljs/v8-to-istanbul/commit/e981cc156b447ce7a936114dafac591126fd65dd))


### Bug Fixes

* consistently resolve paths to absolute form ([#72](https://www.github.com/istanbuljs/v8-to-istanbul/issues/72)) ([55f4116](https://www.github.com/istanbuljs/v8-to-istanbul/commit/55f411624841f89f8309dc460387f8dd15c8b8f4))

### [3.2.6](https://github.com/bcoe/v8-to-istanbul/compare/v3.2.5...v3.2.6) (2019-10-24)


### Bug Fixes

* remove scheme from paths before joining ([#69](https://github.com/bcoe/v8-to-istanbul/issues/69)) ([10612fa](https://github.com/bcoe/v8-to-istanbul/commit/10612fa))

### [3.2.5](https://github.com/bcoe/v8-to-istanbul/compare/v3.2.4...v3.2.5) (2019-10-07)


### Bug Fixes

* fs.promises was not introduced until 10 ([#67](https://github.com/bcoe/v8-to-istanbul/issues/67)) ([cdcc225](https://github.com/bcoe/v8-to-istanbul/commit/cdcc225))

### [3.2.4](https://github.com/bcoe/v8-to-istanbul/compare/v3.2.3...v3.2.4) (2019-10-06)

### [3.2.3](https://github.com/bcoe/v8-to-istanbul/compare/v3.2.2...v3.2.3) (2019-06-24)


### Bug Fixes

* regex for detecting Node < 10.16 was off ([4ca7220](https://github.com/bcoe/v8-to-istanbul/commit/4ca7220))



### [3.2.2](https://github.com/bcoe/v8-to-istanbul/compare/v3.2.1...v3.2.2) (2019-06-24)


### Bug Fixes

* Node >10.16.0 now uses new module wrap API ([7d7c9cb](https://github.com/bcoe/v8-to-istanbul/commit/7d7c9cb))



### [3.2.1](https://github.com/bcoe/v8-to-istanbul/compare/v3.2.0...v3.2.1) (2019-06-23)


### Bug Fixes

* logic for handling sourceRoot did not take into account process.cwd() ([#39](https://github.com/bcoe/v8-to-istanbul/issues/39)) ([6ed9524](https://github.com/bcoe/v8-to-istanbul/commit/6ed9524))



## [3.2.0](https://github.com/bcoe/v8-to-istanbul/compare/v3.1.3...v3.2.0) (2019-06-23)


### Build System

* update testing matrix and deps ([#34](https://github.com/bcoe/v8-to-istanbul/issues/34)) ([204afca](https://github.com/bcoe/v8-to-istanbul/commit/204afca))


### Features

* add a sources option allowing to bypass fs operations ([#36](https://github.com/bcoe/v8-to-istanbul/issues/36)) ([4f5a681](https://github.com/bcoe/v8-to-istanbul/commit/4f5a681))
* add TS typings ([#35](https://github.com/bcoe/v8-to-istanbul/issues/35)) ([5251108](https://github.com/bcoe/v8-to-istanbul/commit/5251108))
* allow sourceMaps with sourceRoot ([#32](https://github.com/bcoe/v8-to-istanbul/issues/32)) ([8eb2ed0](https://github.com/bcoe/v8-to-istanbul/commit/8eb2ed0))



### [3.1.3](https://github.com/bcoe/v8-to-istanbul/compare/v3.1.2...v3.1.3) (2019-05-11)


### Bug Fixes

* **deps:** source-map should be dependency not dev-dependency ([3f6208e](https://github.com/bcoe/v8-to-istanbul/commit/3f6208e))



## [3.1.2](https://github.com/bcoe/v8-to-istanbul/compare/v3.1.1...v3.1.2) (2019-05-02)


### Bug Fixes

* the line with the ignore comment itself should be skipped ([#25](https://github.com/bcoe/v8-to-istanbul/issues/25)) ([e939594](https://github.com/bcoe/v8-to-istanbul/commit/e939594))



## [3.1.1](https://github.com/bcoe/v8-to-istanbul/compare/v3.1.0...v3.1.1) (2019-05-02)


### Bug Fixes

* we should ignore functions and branches ([#24](https://github.com/bcoe/v8-to-istanbul/issues/24)) ([d468559](https://github.com/bcoe/v8-to-istanbul/commit/d468559))



# [3.1.0](https://github.com/bcoe/v8-to-istanbul/compare/v3.0.1...v3.1.0) (2019-05-02)


### Features

* allow uncovered lines to be ignored with special comment ([#23](https://github.com/bcoe/v8-to-istanbul/issues/23)) ([f585cfa](https://github.com/bcoe/v8-to-istanbul/commit/f585cfa))



## [3.0.1](https://github.com/bcoe/v8-to-istanbul/compare/v3.0.0...v3.0.1) (2019-05-01)


### Bug Fixes

* initial column could be 0 on Node 10, after wrapper taken into account ([#22](https://github.com/bcoe/v8-to-istanbul/issues/22)) ([aa3f73b](https://github.com/bcoe/v8-to-istanbul/commit/aa3f73b))



# [3.0.0](https://github.com/bcoe/v8-to-istanbul/compare/v2.0.2...v3.0.0) (2019-04-29)

### Features

* initial support for source-maps ([#19](https://github.com/bcoe/v8-to-istanbul/issues/19)) ([ab0fcdd](https://github.com/bcoe/v8-to-istanbul/commit/ab0fcdd))

### BREAKING CHANGES

* v8-to-istanbul is now async, making it possible to use the latest source-map library


# [2.1.0](https://github.com/bcoe/v8-to-istanbul/compare/v2.0.5...v2.1.0) (2019-04-21)


### Features

* store source so that it can be used by SourceMaps ([#18](https://github.com/bcoe/v8-to-istanbul/issues/18)) ([5afafd6](https://github.com/bcoe/v8-to-istanbul/commit/5afafd6))



## [2.0.5](https://github.com/bcoe/v8-to-istanbul/compare/v2.0.4...v2.0.5) (2019-04-18)


### Bug Fixes

* don't assume files to have CR characters on Windows ([#16](https://github.com/bcoe/v8-to-istanbul/issues/16)) ([c59a21a](https://github.com/bcoe/v8-to-istanbul/commit/c59a21a))



## [2.0.4](https://github.com/bcoe/v8-to-istanbul/compare/v2.0.3...v2.0.4) (2019-04-07)


### Bug Fixes

* Node 11 no longer wraps scripts by default ([#15](https://github.com/bcoe/v8-to-istanbul/issues/15)) ([fbbd113](https://github.com/bcoe/v8-to-istanbul/commit/fbbd113))



## [2.0.3](https://github.com/bcoe/v8-to-istanbul/compare/v2.0.2...v2.0.3) (2019-04-07)



<a name="2.0.2"></a>
## [2.0.2](https://github.com/bcoe/v8-to-istanbul/compare/v2.0.1...v2.0.2) (2019-01-20)


### Bug Fixes

* windows has \r\n line separator ([#11](https://github.com/bcoe/v8-to-istanbul/issues/11)) ([c10b888](https://github.com/bcoe/v8-to-istanbul/commit/c10b888))



<a name="2.0.1"></a>
## [2.0.1](https://github.com/bcoe/v8-to-istanbul/compare/v2.0.0...v2.0.1) (2019-01-20)


### Bug Fixes

* functions were not always counted ([#10](https://github.com/bcoe/v8-to-istanbul/issues/10)) ([464a1f0](https://github.com/bcoe/v8-to-istanbul/commit/464a1f0))



<a name="2.0.0"></a>
# [2.0.0](https://github.com/bcoe/v8-to-istanbul/compare/v1.2.1...v2.0.0) (2018-12-21)


### Features

* allow wrapper length to be configured ([#9](https://github.com/bcoe/v8-to-istanbul/issues/9)) ([5e76198](https://github.com/bcoe/v8-to-istanbul/commit/5e76198))


### BREAKING CHANGES

* we no longer attempt to detect ESM modules, rather the consumer sets a wrapper length



<a name="1.2.1"></a>
## [1.2.1](https://github.com/bcoe/v8-to-istanbul/compare/v1.2.0...v1.2.1) (2018-09-12)



<a name="1.2.0"></a>
# [1.2.0](https://github.com/bcoe/v8-to-istanbul/compare/v1.1.0...v1.2.0) (2017-12-05)


### Features

* support ESM modules ([#3](https://github.com/bcoe/v8-to-istanbul/issues/3)) ([992d13a](https://github.com/bcoe/v8-to-istanbul/commit/992d13a))



<a name="1.1.0"></a>
# 1.1.0 (2017-12-01)


### Features

* initial implementation ([6140c6c](https://github.com/bcoe/v8-to-istanbul/commit/6140c6c))
