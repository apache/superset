# Change Log

All notable changes to this project will be documented in this file. This library adheres to a versioning policy described in [the README](./README.md#versioning). The public API of this library consists of the functions exported in [h3core.js](./lib/h3core.js).

## [Unreleased]

## [3.6.3] - 2019-12-10
### Fixed
- Updated the core library to v3.6.2. This rolls back the polyfill algorithm to previous version; we'll roll forward again once we've fixed the known issues.


## [3.6.2] - 2019-11-11
### Fixed
- Improved TypeScript typedefs (#73)
- Fix `polyfill` edge cases, improve perfomance (#74)
### Changed
- Updated the core library to v3.6.1 (#74)

## [3.6.1] - 2019-09-19
### Fixed
- Downgraded required `yarn` version (#68)

## [3.6.0] - 2019-09-12
### Fixed
- Removed `unhandledRejection` handling from emscripten build (#64)
- Fixed TypeScript definition file, added a CI test to guard against regressions (#65)
### Changed
- Updated the core library to v3.6.0 (#61)
### Added
- Added bindings for `getPentagonIndexes` and `h3ToCenterChild` (#61)

## [3.5.0] - 2019-07-24
### Added
- Added `h3GetFaces` binding (#54)
- Generated a TypeScript definition file from jsdoc comments (#55)
### Changed
- Updated the core library to v3.5.0 (#52, #54)

## [3.4.3] - 2019-04-01
### Added
- Changed module exports to ES6 syntax (#41)
- Added UMD bundle to published package (#41)
- Added separate bundles with an Emscripten browser-only build (#43)

## [3.4.2] - 2019-02-08
### Fixed
- Changed `const` to `var` for better compatibility in Emscripten-generated code (#37)

## [3.4.1] - 2019-01-25
### Fixed
- Updated Emscripten, removing hack for `getTempRet0`

## [3.4.0] - 2019-01-24
### Changed
- Updated the core library to v3.4.0 (#31)
### Added
- Added `getRes0Indexes` binding (#31)

## [3.3.0] - 2019-01-08
### Changed
- Updated the core library to v3.3.0 (#29)
### Added
- Added `h3Line` binding (#29)

## [3.2.0] - 2018-10-31
### Changed
- Updated the core library to v3.2.0 (#26)
### Added
- Added `experimentalH3ToLocalIj` and `experimentalLocalIjToH3` bindings (#26)

## [3.1.1] - 2018-08-30
### Fixed
- Updated the core library to v3.1.1, including fixes for `polyfill` and `h3SetToMultiPolygon` (#19)
- Removed Emscripten Node error handling from built library, fixing stacktraces (#18)
### Added
- Added generated API documentation to README (#17)

## [3.1.0] - 2018-08-13
### Added
- Added binding for `h3Distance` (#15)
### Changed
- Updated the core library to v3.1.0 (#15)
- Moved emscripten build to docker (#14)

## [3.0.2] - 2018-07-26
### Changed
- Updated the core library to v3.0.8 (#10)
- Renamed names of h3.1 or h3-1 to h3 (#4)
- Added engine support for Node 10 (#11)

## [3.0.1] - 2018-06-18
### Fixed
- Fixed npm distribution

## [3.0.0] - 2018-06-18
### Added
-   First public release.
