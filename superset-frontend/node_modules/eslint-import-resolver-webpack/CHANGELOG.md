# Change Log
All notable changes to this resolver will be documented in this file.
This project adheres to [Semantic Versioning](http://semver.org/).
This change log adheres to standards from [Keep a CHANGELOG](http://keepachangelog.com).

## Unreleased

## 0.10.1 - 2018-06-24
### Fixed
- log a useful error in a module bug arises ([#768]/[#767], thanks [@mattkrick])

## 0.10.0 - 2018-05-17
### Changed
- cache webpack resolve function, for performance ([#788]/[#1091])

## 0.9.0 - 2018-03-29
### Breaking
- Fix with `pnpm` by bumping `resolve` ([#968])

## 0.8.4 - 2018-01-05
### Changed
- allow newer version of node-libs-browser ([#969])

## 0.8.3 - 2017-06-23
### Changed
- `debug` bumped to match others

## 0.8.2 - 2017-06-22
### Changed
- `webpack` peer dep updated to >= 1.11 (works fine with webpack 3 AFAICT)

## 0.8.1 - 2017-01-19
### Changed
- official support for Webpack 2.2.0 (RC), thanks [@graingert]

## 0.8.0 - 2016-12-15
### Changed
- bumped `resolve` to fix issues with Node builtins (thanks [@SkeLLLa] and [@ljharb])
- allow `enhanced-resolve` to be version `>= 2` (thanks [@Kovensky])

## 0.7.1
### Fixed
- missing `has` dependency ([#681] + [#683], thanks [@benmvp] + [@ljharb])

## 0.7.0
### Added
- Support for explicit Webpack config object in `.eslintrc.*`. ([#572], thanks [@jameslnewell])
- Added `resolve.modules` to configs for webpack2 support ([#569], thanks [@toshafed])

## 0.6.0 - 2016-09-13
### Added
- support for config-as-function ([#533], thanks [@grahamb])

## 0.5.1 - 2016-08-11
### Fixed
- don't throw and die if no webpack config is found

## 0.5.0 - 2016-08-11
### Added
- support for Webpack 2 + `module` package.json key! ([#475], thanks [@taion])

### Changed
- don't swallow errors, assume config exists ([#435], thanks [@Kovensky])

## 0.4.0 - 2016-07-17
### Added
- support for `webpack.ResolverPlugin` ([#377], thanks [@Rogeres])

### Fixed
- provide string `context` to `externals` functions ([#411] + [#413], thanks [@Satyam])

## 0.3.2 - 2016-06-30
### Added
- shared config ([config.js](./config.js)) with barebones settings needed to use this resolver. ([#283])

### Fixed
- strip resource query ([#357], thanks [@daltones])
- allow `externals` to be defined as a function ([#363], thanks [@kesne])

## 0.3.1 - 2016-06-02
### Added
- debug logging. run with `DEBUG=eslint-plugin-import:*` to see log output.

## 0.3.0 - 2016-06-01
### Changed
- use `enhanced-resolve` to support additional plugins instead of re-implementing
  aliases, etc.

## 0.2.5 - 2016-05-23
### Added
- Added support for multiple webpack configs ([#181], thanks [@GreenGremlin])

## 0.2.4 - 2016-04-29
### Changed
- automatically find webpack config with `interpret`-able extensions ([#287], thanks [@taion])

## 0.2.3 - 2016-04-28
### Fixed
- `interpret` dependency was declared in the wrong `package.json`.
   Thanks [@jonboiser] for sleuthing ([#286]) and fixing ([#289]).

## 0.2.2 - 2016-04-27
### Added
- `interpret` configs (such as `.babel.js`).
  Thanks to [@gausie] for the initial PR ([#164], ages ago! 😅) and [@jquense] for tests ([#278]).

[#1091]: https://github.com/benmosher/eslint-plugin-import/pull/1091
[#969]: https://github.com/benmosher/eslint-plugin-import/pull/969
[#968]: https://github.com/benmosher/eslint-plugin-import/pull/968
[#768]: https://github.com/benmosher/eslint-plugin-import/pull/768
[#683]: https://github.com/benmosher/eslint-plugin-import/pull/683
[#572]: https://github.com/benmosher/eslint-plugin-import/pull/572
[#569]: https://github.com/benmosher/eslint-plugin-import/pull/569
[#533]: https://github.com/benmosher/eslint-plugin-import/pull/533
[#413]: https://github.com/benmosher/eslint-plugin-import/pull/413
[#377]: https://github.com/benmosher/eslint-plugin-import/pull/377
[#363]: https://github.com/benmosher/eslint-plugin-import/pull/363
[#289]: https://github.com/benmosher/eslint-plugin-import/pull/289
[#287]: https://github.com/benmosher/eslint-plugin-import/pull/287
[#278]: https://github.com/benmosher/eslint-plugin-import/pull/278
[#181]: https://github.com/benmosher/eslint-plugin-import/pull/181
[#164]: https://github.com/benmosher/eslint-plugin-import/pull/164

[#788]: https://github.com/benmosher/eslint-plugin-import/issues/788
[#767]: https://github.com/benmosher/eslint-plugin-import/issues/767
[#681]: https://github.com/benmosher/eslint-plugin-import/issues/681
[#435]: https://github.com/benmosher/eslint-plugin-import/issues/435
[#411]: https://github.com/benmosher/eslint-plugin-import/issues/411
[#357]: https://github.com/benmosher/eslint-plugin-import/issues/357
[#286]: https://github.com/benmosher/eslint-plugin-import/issues/286
[#283]: https://github.com/benmosher/eslint-plugin-import/issues/283

[@gausie]: https://github.com/gausie
[@jquense]: https://github.com/jquense
[@taion]: https://github.com/taion
[@GreenGremlin]: https://github.com/GreenGremlin
[@daltones]: https://github.com/daltones
[@kesne]: https://github.com/kesne
[@Satyam]: https://github.com/Satyam
[@Rogeres]: https://github.com/Rogeres
[@Kovensky]: https://github.com/Kovensky
[@grahamb]: https://github.com/grahamb
[@jameslnewell]: https://github.com/jameslnewell
[@toshafed]: https://github.com/toshafed
[@benmvp]: https://github.com/benmvp
[@ljharb]: https://github.com/ljharb
[@SkeLLLa]: https://github.com/SkeLLLa
[@graingert]: https://github.com/graingert
[@mattkrick]: https://github.com/mattkrick
