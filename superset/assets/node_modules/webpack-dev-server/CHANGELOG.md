# Change Log

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

<a name="3.1.14"></a>
## [3.1.14](https://github.com/webpack/webpack-dev-server/compare/v3.1.13...v3.1.14) (2018-12-24)


### Bug Fixes

* add workaround for Origin header in sockjs ([#1608](https://github.com/webpack/webpack-dev-server/issues/1608)) ([1dfd4fb](https://github.com/webpack/webpack-dev-server/commit/1dfd4fb))



<a name="3.1.13"></a>
## [3.1.13](https://github.com/webpack/webpack-dev-server/compare/v3.1.12...v3.1.13) (2018-12-22)


### Bug Fixes

* delete a comma for Node.js <= v7.x ([#1609](https://github.com/webpack/webpack-dev-server/issues/1609)) ([0bab1c0](https://github.com/webpack/webpack-dev-server/commit/0bab1c0))



<a name="3.1.12"></a>
## [3.1.12](https://github.com/webpack/webpack-dev-server/compare/v3.1.11...v3.1.12) (2018-12-22)


### Bug Fixes

* regression in `checkHost` for checking Origin header ([#1606](https://github.com/webpack/webpack-dev-server/issues/1606)) ([8bb3ca8](https://github.com/webpack/webpack-dev-server/commit/8bb3ca8))



<a name="3.1.11"></a>
## [3.1.11](https://github.com/webpack/webpack-dev-server/compare/v3.1.10...v3.1.11) (2018-12-21)


### Bug Fixes

* **bin/options:** correct check for color support (`options.color`) ([#1555](https://github.com/webpack/webpack-dev-server/issues/1555)) ([55398b5](https://github.com/webpack/webpack-dev-server/commit/55398b5))
* **package:** update `spdy` v3.4.1...4.0.0 (assertion error) ([#1491](https://github.com/webpack/webpack-dev-server/issues/1491)) ([#1563](https://github.com/webpack/webpack-dev-server/issues/1563)) ([7a3a257](https://github.com/webpack/webpack-dev-server/commit/7a3a257))
* **Server:** correct `node` version checks ([#1543](https://github.com/webpack/webpack-dev-server/issues/1543)) ([927a2b3](https://github.com/webpack/webpack-dev-server/commit/927a2b3))
* **Server:** mime type for wasm in contentBase directory ([#1575](https://github.com/webpack/webpack-dev-server/issues/1575)) ([#1580](https://github.com/webpack/webpack-dev-server/issues/1580)) ([fadae5d](https://github.com/webpack/webpack-dev-server/commit/fadae5d))
* add url for compatibility with webpack@5 ([#1598](https://github.com/webpack/webpack-dev-server/issues/1598)) ([#1599](https://github.com/webpack/webpack-dev-server/issues/1599)) ([68dd49a](https://github.com/webpack/webpack-dev-server/commit/68dd49a))
* check origin header for websocket connection ([#1603](https://github.com/webpack/webpack-dev-server/issues/1603)) ([b3217ca](https://github.com/webpack/webpack-dev-server/commit/b3217ca))



<a name="3.1.10"></a>
## [3.1.10](https://github.com/webpack/webpack-dev-server/compare/v3.1.9...v3.1.10) (2018-10-23)


### Bug Fixes

* **options:** add `writeToDisk` option to schema ([#1520](https://github.com/webpack/webpack-dev-server/issues/1520)) ([d2f4902](https://github.com/webpack/webpack-dev-server/commit/d2f4902))
* **package:** update `sockjs-client` v1.1.5...1.3.0 (`url-parse` vulnerability) ([#1537](https://github.com/webpack/webpack-dev-server/issues/1537)) ([e719959](https://github.com/webpack/webpack-dev-server/commit/e719959))
* **Server:** set `tls.DEFAULT_ECDH_CURVE` to `'auto'` ([#1531](https://github.com/webpack/webpack-dev-server/issues/1531)) ([c12def3](https://github.com/webpack/webpack-dev-server/commit/c12def3))



<a name="3.1.9"></a>
## [3.1.9](https://github.com/webpack/webpack-dev-server/compare/v3.1.8...v3.1.9) (2018-09-24)



<a name="3.1.8"></a>
## [3.1.8](https://github.com/webpack/webpack-dev-server/compare/v3.1.7...v3.1.8) (2018-09-06)


### Bug Fixes

* **package:** `yargs` security vulnerability (`dependencies`) ([#1492](https://github.com/webpack/webpack-dev-server/issues/1492)) ([8fb67c9](https://github.com/webpack/webpack-dev-server/commit/8fb67c9))
* **utils/createLogger:** ensure `quiet` always takes precedence (`options.quiet`) ([#1486](https://github.com/webpack/webpack-dev-server/issues/1486)) ([7a6ca47](https://github.com/webpack/webpack-dev-server/commit/7a6ca47))



<a name="3.1.7"></a>
## [3.1.7](https://github.com/webpack/webpack-dev-server/compare/v3.1.6...v3.1.7) (2018-08-29)


### Bug Fixes

* **Server:** don't use `spdy` on `node >= v10.0.0` ([#1451](https://github.com/webpack/webpack-dev-server/issues/1451)) ([8ab9eb6](https://github.com/webpack/webpack-dev-server/commit/8ab9eb6))



<a name="3.1.6"></a>
## [3.1.6](https://github.com/webpack/webpack-dev-server/compare/v3.1.5...v3.1.6) (2018-08-26)


### Bug Fixes

* **bin:** handle `process` signals correctly when the server isn't ready yet ([#1432](https://github.com/webpack/webpack-dev-server/issues/1432)) ([334c3a5](https://github.com/webpack/webpack-dev-server/commit/334c3a5))
* **examples/cli:** correct template path in `open-page` example ([#1401](https://github.com/webpack/webpack-dev-server/issues/1401)) ([df30727](https://github.com/webpack/webpack-dev-server/commit/df30727))
* **schema:** allow the `output` filename to be a `{Function}` ([#1409](https://github.com/webpack/webpack-dev-server/issues/1409)) ([e2220c4](https://github.com/webpack/webpack-dev-server/commit/e2220c4))
