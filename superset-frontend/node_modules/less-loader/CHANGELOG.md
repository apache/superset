# Change Log

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

<a name="5.0.0"></a>
# [5.0.0](https://github.com/webpack-contrib/less-loader/compare/v4.1.0...v5.0.0) (2019-04-29)


### Bug Fixes

* webpack watching does not recover after broken less is fixed ([#289](https://github.com/webpack-contrib/less-loader/issues/289)) ([f41d12e](https://github.com/webpack-contrib/less-loader/commit/f41d12e))


### Chores

* remove old bits mentioning webpack < 4 and node < 6 ([#286](https://github.com/webpack-contrib/less-loader/issues/286)) ([012eb8f](https://github.com/webpack-contrib/less-loader/commit/012eb8f))


### Code Refactoring

* remove deprecated compress option ([#283](https://github.com/webpack-contrib/less-loader/issues/283)) ([3d6e9e9](https://github.com/webpack-contrib/less-loader/commit/3d6e9e9))


### BREAKING CHANGES

* remove deprecated compress option.
* drop support for node < 6.9 and webpack < 4



<a name="4.1.0"></a>
# [4.1.0](https://github.com/webpack-contrib/less-loader/compare/v4.0.6...v4.1.0) (2018-03-09)


### Features

* **package:** support `less >= v3.0.0` ([#242](https://github.com/webpack-contrib/less-loader/issues/242)) ([d8c9d83](https://github.com/webpack-contrib/less-loader/commit/d8c9d83))



<a name="4.0.6"></a>
## [4.0.6](https://github.com/webpack-contrib/less-loader/compare/v4.0.5...v4.0.6) (2018-02-27)


### Bug Fixes

* **package:** add `webpack >= v4.0.0` (`peerDependencies`) ([#245](https://github.com/webpack-contrib/less-loader/issues/245)) ([011cc73](https://github.com/webpack-contrib/less-loader/commit/011cc73))



<a name="4.0.5"></a>
## [4.0.5](https://github.com/webpack-contrib/less-loader/compare/v4.0.4...v4.0.5) (2017-07-10)


### Chore

* support `webpack@3` ([670ab18](https://github.com/webpack-contrib/less-loader/commit/670ab18))


<a name="4.0.4"></a>
## [4.0.4](https://github.com/webpack-contrib/less-loader/compare/v4.0.3...v4.0.4) (2017-05-30)


### Bug Fixes

* resolve `[@import](https://github.com/import)` with absolute paths ([#201](https://github.com/webpack-contrib/less-loader/issues/201)) ([a3f9601](https://github.com/webpack-contrib/less-loader/commit/a3f9601)), closes [webpack-contrib/less-loader#93](https://github.com/webpack-contrib/less-loader/issues/93)



<a name="4.0.3"></a>
## [4.0.3](https://github.com/webpack-contrib/less-loader/compare/v4.0.2...v4.0.3) (2017-03-30)


### Bug Fixes

* sourcesContent missing in source maps ([df28035](https://github.com/webpack-contrib/less-loader/commit/df28035))



<a name="4.0.2"></a>
## [4.0.2](https://github.com/webpack-contrib/less-loader/compare/v4.0.1...v4.0.2) (2017-03-21)


### Bug Fixes

* Plugin.install is not a function ([f8ae245](https://github.com/webpack-contrib/less-loader/commit/f8ae245))



<a name="4.0.1"></a>
## [4.0.1](https://github.com/webpack-contrib/less-loader/compare/v4.0.0...v4.0.1) (2017-03-21)


### Bug Fixes

* wrong entry point in package.json ([918bfe9](https://github.com/webpack-contrib/less-loader/commit/918bfe9)), closes [#161](https://github.com/webpack-contrib/less-loader/issues/161) [#179](https://github.com/webpack-contrib/less-loader/issues/179) [#177](https://github.com/webpack-contrib/less-loader/issues/177)



<a name="4.0.0"></a>
# [4.0.0](https://github.com/webpack-contrib/less-loader/compare/v3.0.0...v4.0.0) (2017-03-20)


### Bug Fixes

* error where not all files were watched ([53c90fc](https://github.com/webpack-contrib/less-loader/commit/53c90fc))
* resolve alias ([98d4e63](https://github.com/webpack-contrib/less-loader/commit/98d4e63))


### Chores

* **dependencies:** Update peer dependencies ([24a6f66](https://github.com/webpack-contrib/less-loader/commit/24a6f66))


### Features

* **source-maps:** refactor source maps handling ([895044f](https://github.com/webpack-contrib/less-loader/commit/895044f))
* allow user to choose between resolvers ([1d6e505](https://github.com/webpack-contrib/less-loader/commit/1d6e505))
* improve formatting of error messages ([39772a5](https://github.com/webpack-contrib/less-loader/commit/39772a5))
* make any file type importable ([d3022b8](https://github.com/webpack-contrib/less-loader/commit/d3022b8))
* remove root option ([39ad4f8](https://github.com/webpack-contrib/less-loader/commit/39ad4f8))


### BREAKING CHANGES

* If you've already configured your `resolve.alias` with a `.less` extension, you can now remove that wrong extension.
* The root option was never documented, so it's very unlikely that this is actually a breaking change. However, since the option was removed, we need to flag this as breaking.
* **dependencies:** Require webpack 2 as peer dependency
* **source-maps:** Since the map is now passed as an object to the next loader, this could potentially break if another loader than the css-loader is used. The css-loader accepts both.



Changelog
---------

### 3.0.0

- **Breaking**: Remove node 0.10 and 0.12 support
- **Breaking**: Remove official webpack 1 support. There are no breaking changes for webpack 1 with `3.0.0`, but future release won't be tested against webpack 1
- **Breaking**: Remove synchronous compilation support [#152](https://github.com/webpack-contrib/less-loader/pull/152) [#84](https://github.com/webpack-contrib/less-loader/issues/84)
- Reduce npm package size by using the [files](https://docs.npmjs.com/files/package.json#files) property in the `package.json`


### 2.2.3

- Fix missing path information in source map [#73](https://github.com/webpack/less-loader/pull/73)
- Add deprecation warning [#84](https://github.com/webpack/less-loader/issues/84)

### 2.2.2

- Fix issues with synchronous less functions like `data-uri()`, `image-size()`, `image-width()`, `image-height()` [#31](https://github.com/webpack/less-loader/issues/31) [#38](https://github.com/webpack/less-loader/issues/38) [#43](https://github.com/webpack/less-loader/issues/43) [#58](https://github.com/webpack/less-loader/pull/58)

### 2.2.1

- Improve Readme

### 2.2.0

- Added option to specify LESS plugins [#40](https://github.com/webpack/less-loader/pull/40)
