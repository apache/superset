# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

## [2.0.0](https://github.com/webpack/loader-utils/compare/v1.4.0...v2.0.0) (2020-03-17)


### ⚠ BREAKING CHANGES

* minimum required `Node.js` version is `8.9.0` ([#166](https://github.com/webpack/loader-utils/issues/166)) ([c937e8c](https://github.com/webpack/loader-utils/commit/c937e8c77231b42018be616b784a6b45eac86f8a))
* the `getOptions` method returns empty object on empty query ([#167](https://github.com/webpack/loader-utils/issues/167)) ([b595cfb](https://github.com/webpack/loader-utils/commit/b595cfba022d3f04f3d310dd570b0253e461605b))
* Use `md4` by default

<a name="1.4.0"></a>
# [1.4.0](https://github.com/webpack/loader-utils/compare/v1.3.0...v1.4.0) (2020-02-19)


### Features

* the `resourceQuery` is passed to the `interpolateName` method ([#163](https://github.com/webpack/loader-utils/issues/163)) ([cd0e428](https://github.com/webpack/loader-utils/commit/cd0e428))



<a name="1.3.0"></a>
# [1.3.0](https://github.com/webpack/loader-utils/compare/v1.2.3...v1.3.0) (2020-02-19)


### Features

* support the `[query]` template for the `interpolatedName` method ([#162](https://github.com/webpack/loader-utils/issues/162)) ([469eeba](https://github.com/webpack/loader-utils/commit/469eeba))



<a name="1.2.3"></a>
## [1.2.3](https://github.com/webpack/loader-utils/compare/v1.2.2...v1.2.3) (2018-12-27)


### Bug Fixes

* **interpolateName:** don't interpolated `hashType` without `hash` or `contenthash`  ([#140](https://github.com/webpack/loader-utils/issues/140)) ([3528fd9](https://github.com/webpack/loader-utils/commit/3528fd9))



<a name="1.2.2"></a>
## [1.2.2](https://github.com/webpack/loader-utils/compare/v1.2.1...v1.2.2) (2018-12-27)


### Bug Fixes

* fixed a hash type extracting in interpolateName ([#137](https://github.com/webpack/loader-utils/issues/137)) ([f8a71f4](https://github.com/webpack/loader-utils/commit/f8a71f4))



<a name="1.2.1"></a>
## [1.2.1](https://github.com/webpack/loader-utils/compare/v1.2.0...v1.2.1) (2018-12-25)


### Bug Fixes

* **isUrlRequest:** better handle absolute urls and non standards ([#134](https://github.com/webpack/loader-utils/issues/134)) ([aca43da](https://github.com/webpack/loader-utils/commit/aca43da))


### Reverts

* PR [#79](https://github.com/webpack/loader-utils/issues/79) ([#135](https://github.com/webpack/loader-utils/issues/135)) ([73d350a](https://github.com/webpack/loader-utils/commit/73d350a))



<a name="1.2.0"></a>
# [1.2.0](https://github.com/webpack/loader-utils/compare/v1.1.0...v1.2.0) (2018-12-24)


### Features

* **interpolateName:** support `[contenthash]`

### Fixes

* **urlToRequest:** empty urls are not rewritten to relative requests
* **urlToRequest:** don't rewrite absolute urls
* **isUrlRequest:** ignore all url with `extension` (like `moz-extension:`, `ms-browser-extension:` and etc)
* **isUrlRequest:** ignore `about:blank`
* **interpolateName:** failing explicitly when ran out of emoji
* **interpolateName:** `[hash]` token regex in interpolate string to capture any hash algorithm name
* **interpolateName:** parse string for emoji count before use



<a name="1.1.0"></a>
# [1.1.0](https://github.com/webpack/loader-utils/compare/v1.0.4...v1.1.0) (2017-03-16)


### Features

* **automatic-release:** Generation of automatic release ([7484d13](https://github.com/webpack/loader-utils/commit/7484d13))
* **parseQuery:** export parseQuery ([ddf64e4](https://github.com/webpack/loader-utils/commit/ddf64e4))
