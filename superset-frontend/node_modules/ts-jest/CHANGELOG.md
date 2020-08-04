<a name="25.4.0"></a>
# [25.4.0](https://github.com/kulshekhar/ts-jest/compare/v25.3.1...v25.4.0) (2020-04-17)


### Bug Fixes

* **compiler:** make `projectReferences` work with `isolatedModules: true` ([#1527](https://github.com/kulshekhar/ts-jest/issues/1527)) ([aa6b74c](https://github.com/kulshekhar/ts-jest/commit/aa6b74c))
* **compiler:** make sure `LanguageService` updated with test file information before getting diagnostics for test file ([#1507](https://github.com/kulshekhar/ts-jest/issues/1507)) ([311eaeb](https://github.com/kulshekhar/ts-jest/commit/311eaeb))
* **config:** set default `outDir` when `allowJs` is true and no `outDir` in `tsconfig` ([#1502](https://github.com/kulshekhar/ts-jest/issues/1502)) ([1a287ad](https://github.com/kulshekhar/ts-jest/commit/1a287ad))
* **config:** use original jest config object instead of stringified config ([#1511](https://github.com/kulshekhar/ts-jest/issues/1511)) ([4f0bb33](https://github.com/kulshekhar/ts-jest/commit/4f0bb33))



<a name="25.3.1"></a>
## [25.3.1](https://github.com/kulshekhar/ts-jest/compare/v25.3.0...v25.3.1) (2020-04-03)


### Bug Fixes

* only do type checking while compiling file ([#1483](https://github.com/kulshekhar/ts-jest/issues/1483)) ([dbc0a08](https://github.com/kulshekhar/ts-jest/commit/dbc0a08))
* **config:** set default outDir for enabled allowJs without outDir ([#1472](https://github.com/kulshekhar/ts-jest/issues/1472)) ([57c7af0](https://github.com/kulshekhar/ts-jest/commit/57c7af0))



<a name="25.3.0"></a>
# [25.3.0](https://github.com/kulshekhar/ts-jest/compare/25.2.1...v25.3.0) (2020-03-30)


### Bug Fixes

* add `jest-config` to dependencies list ([6d9e0d8](https://github.com/kulshekhar/ts-jest/commit/6d9e0d8))
* always do type check for all files provided to ts-jest transformer for non-watch mode ([#1450](https://github.com/kulshekhar/ts-jest/issues/1450)) ([107e062](https://github.com/kulshekhar/ts-jest/commit/107e062))


### Chores

* **docs:** add `TROUBLESHOOTING` ([96cd9b3](https://github.com/kulshekhar/ts-jest/commit/b8ebf36))


### Features

* **compiler:** expose internal ts `Program` via ConfigSet `TsCompiler` ([#1433](https://github.com/kulshekhar/ts-jest/issues/1433)) ([7153246](https://github.com/kulshekhar/ts-jest/commit/7153246))
* **config:** add incremental option ([#1418](https://github.com/kulshekhar/ts-jest/issues/1418)) ([5a69bce](https://github.com/kulshekhar/ts-jest/commit/5a69bce))


### BREAKING CHANGES

* **config:** improve diagnostics message ([#1444](https://github.com/kulshekhar/ts-jest/issues/1444)) ([96cd9b3](https://github.com/kulshekhar/ts-jest/commit/96cd9b3)). This will affect to any snapshots or assertion against diagnostics messages



<a name="25.2.1"></a>
# [25.2.1](https://github.com/kulshekhar/ts-jest/compare/25.2.0...25.2.1) (2020-02-21)


### Bug Fixes

* **compiler:** allow transformation of typescript files in node_modules ([#1385](https://github.com/kulshekhar/ts-jest/issues/1385)) ([814405e](https://github.com/kulshekhar/ts-jest/commit/814405e))
* **docs:** fixing slack link and some minor typos in documenation ([#1404](https://github.com/kulshekhar/ts-jest/issues/1404)) ([3e2e008](https://github.com/kulshekhar/ts-jest/commit/3e2e008))
* **transformer:** add deepUnmock to hoist method list ([#1372](https://github.com/kulshekhar/ts-jest/issues/1372)) ([0fbbc00](https://github.com/kulshekhar/ts-jest/commit/0fbbc00))
* **util:** use resolve package typescript package in yarn workspaces ([#1377](https://github.com/kulshekhar/ts-jest/issues/1377)) ([a63808c](https://github.com/kulshekhar/ts-jest/commit/a63808c))



<a name="25.2.0"></a>
# [25.2.0](https://github.com/kulshekhar/ts-jest/compare/v25.1.0...v25.2.0) (2020-02-03)


### Bug Fixes

* **config:** let babel-jest handle loading babel config ([#1370](https://github.com/kulshekhar/ts-jest/issues/1370))



<a name="25.1.0"></a>
# [25.1.0](https://github.com/kulshekhar/ts-jest/compare/v25.0.0...v25.1.0) (2020-01-30)


### Bug Fixes

* jest 25 type definitions ([#1363](https://github.com/kulshekhar/ts-jest/issues/1363)) ([ba82a9e](https://github.com/kulshekhar/ts-jest/commit/ba82a9e))



<a name="25.0.0"></a>
# [25.0.0](https://github.com/kulshekhar/ts-jest/compare/v24.3.0...v25.0.0) (2020-01-23)


### Features

* support Jest 25 ([#1355](https://github.com/kulshekhar/ts-jest/issues/1355))



<a name="24.3.0"></a>
# [24.3.0](https://github.com/kulshekhar/ts-jest/compare/v24.2.0...v24.3.0) (2020-01-07)


### Bug Fixes

* **config:** support babel config file path as string ([#1332](https://github.com/kulshekhar/ts-jest/issues/1332)) ([78a53c2](https://github.com/kulshekhar/ts-jest/commit/78a53c2))



<a name="24.2.0"></a>
# [24.2.0](https://github.com/kulshekhar/ts-jest/compare/v24.1.0...v24.2.0) (2019-11-22)


### Bug Fixes

* **compiler:** pass filename to sha function instead of file extension ([ac1ac97](https://github.com/kulshekhar/ts-jest/commit/ac1ac97))
* **transformers:** hoist jest.enableAutomock and jest.disableAutomock ([ac50bc3](https://github.com/kulshekhar/ts-jest/commit/ac50bc3))
* typescript serviceHost cache miss on Windows operating systems ([26ee731](https://github.com/kulshekhar/ts-jest/commit/26ee731))



<a name="24.1.0"></a>
# [24.1.0](https://github.com/kulshekhar/ts-jest/compare/v24.0.2...v24.1.0) (2019-09-12)


### Bug Fixes

* **perf:** add cache for fs calls ([#908](https://github.com/kulshekhar/ts-jest/issues/908)) ([3dada81](https://github.com/kulshekhar/ts-jest/commit/3dada81))
* [#825](https://github.com/kulshekhar/ts-jest/issues/825) handle symlinked modules (ala pnpm) correctly ([e190b23](https://github.com/kulshekhar/ts-jest/commit/e190b23))
* handle tsBuildInfoFile option ([f9583e9](https://github.com/kulshekhar/ts-jest/commit/f9583e9)), closes [#1095](https://github.com/kulshekhar/ts-jest/issues/1095)
* **types:** unforce esModuleInterop in tsconfig.json ([c2d39b6](https://github.com/kulshekhar/ts-jest/commit/c2d39b6))



<a name="24.0.2"></a>
## [24.0.2](https://github.com/kulshekhar/ts-jest/compare/v24.0.1...v24.0.2) (2019-04-05)



<a name="24.0.1"></a>
## [24.0.1](https://github.com/kulshekhar/ts-jest/compare/v24.0.0...v24.0.1) (2019-03-30)


### Bug Fixes

* update call to globIgnore ([#1002](https://github.com/kulshekhar/ts-jest/issues/1002)) ([#1003](https://github.com/kulshekhar/ts-jest/issues/1003)) ([05b63af](https://github.com/kulshekhar/ts-jest/commit/05b63af))


### Features

* **config:** specify package.json location ([#823](https://github.com/kulshekhar/ts-jest/issues/823)) ([#1013](https://github.com/kulshekhar/ts-jest/issues/1013)) ([fb7dd55](https://github.com/kulshekhar/ts-jest/commit/fb7dd55))



<a name="24.0.0"></a>
# [24.0.0](https://github.com/kulshekhar/ts-jest/compare/v23.10.5...v24.0.0) (2019-02-18)


### Bug Fixes

* cli test ([1d67101](https://github.com/kulshekhar/ts-jest/commit/1d67101))
* module tests and some snapshots ([999f889](https://github.com/kulshekhar/ts-jest/commit/999f889))
* remove unused snapshots ([108b08b](https://github.com/kulshekhar/ts-jest/commit/108b08b))
* some tests ([d0f2231](https://github.com/kulshekhar/ts-jest/commit/d0f2231))
* test command ([8372b5e](https://github.com/kulshekhar/ts-jest/commit/8372b5e))
* test path for windows (attempt 1) ([6824ac4](https://github.com/kulshekhar/ts-jest/commit/6824ac4))
* test path for windows (attempt 2) ([eb2fc8a](https://github.com/kulshekhar/ts-jest/commit/eb2fc8a))


### Features

* **jest:** bump to 24 ([defcb77](https://github.com/kulshekhar/ts-jest/commit/defcb77))



<a name="23.10.4"></a>
## [23.10.4](https://github.com/kulshekhar/ts-jest/compare/v23.10.3...v23.10.4) (2018-10-06)


### Bug Fixes

* **cache:** adds project's dep versions to cache key ([6cacbea](https://github.com/kulshekhar/ts-jest/commit/6cacbea)), closes [#785](https://github.com/kulshekhar/ts-jest/issues/785)
* **cli:** change options to better reflect the new presets ([68abcfb](https://github.com/kulshekhar/ts-jest/commit/68abcfb))
* **helpers:** deprecate import from ts-jest, now ts-jest/utils ([33ff29f](https://github.com/kulshekhar/ts-jest/commit/33ff29f)), closes [#782](https://github.com/kulshekhar/ts-jest/issues/782)
* **typings:** typo in presets definition file ([53767ab](https://github.com/kulshekhar/ts-jest/commit/53767ab))
* **typings:** wrong import in preset typings + test ([94dc4e7](https://github.com/kulshekhar/ts-jest/commit/94dc4e7))



<a name="23.10.3"></a>
## [23.10.3](https://github.com/kulshekhar/ts-jest/compare/v23.10.2...v23.10.3) (2018-09-30)


### Bug Fixes

* **compiler:** do not force module kind if piping babel ([acebc8c](https://github.com/kulshekhar/ts-jest/commit/acebc8c)), closes [#767](https://github.com/kulshekhar/ts-jest/issues/767)


### Features

* **helpers:** adds a mocked test helper for mock typings ([f976135](https://github.com/kulshekhar/ts-jest/commit/f976135)), closes [#576](https://github.com/kulshekhar/ts-jest/issues/576)



<a name="23.10.2"></a>
## [23.10.2](https://github.com/kulshekhar/ts-jest/compare/v23.10.1...v23.10.2) (2018-09-26)


### Bug Fixes

* **cache:** resolved tsconfig in cache key + pkg digest ([e891608](https://github.com/kulshekhar/ts-jest/commit/e891608)), closes [#749](https://github.com/kulshekhar/ts-jest/issues/749)
* **cli:** resets testMatch if using testRegex option ([31ad0aa](https://github.com/kulshekhar/ts-jest/commit/31ad0aa)), closes [#756](https://github.com/kulshekhar/ts-jest/issues/756)
* **diagnostics:** throws only for category warning and error ([bb28849](https://github.com/kulshekhar/ts-jest/commit/bb28849)), closes [#748](https://github.com/kulshekhar/ts-jest/issues/748)
* **import:** wrong error message when a module exists but fails ([e0d6c57](https://github.com/kulshekhar/ts-jest/commit/e0d6c57))
* **preset:** createJestPreset fails with base and no array ([3c325e8](https://github.com/kulshekhar/ts-jest/commit/3c325e8))


### Features

* **cli:** CLI 'config:migrate' now detects best preset ([febd8d3](https://github.com/kulshekhar/ts-jest/commit/febd8d3))
* **preset:** adds 2 presets along the default one ([9f3d759](https://github.com/kulshekhar/ts-jest/commit/9f3d759))
* **preset:** adds presets typings and export all presets ([f55d895](https://github.com/kulshekhar/ts-jest/commit/f55d895))
* **typings:** emit declaration files, filtering out internals ([4f10f7e](https://github.com/kulshekhar/ts-jest/commit/4f10f7e)), closes [#745](https://github.com/kulshekhar/ts-jest/issues/745)



<a name="23.10.1"></a>
## [23.10.1](https://github.com/kulshekhar/ts-jest/compare/v23.10.0...v23.10.1) (2018-09-20)


### Bug Fixes

* **compile:** js files were never transpiled thru TS ([374dca1](https://github.com/kulshekhar/ts-jest/commit/374dca1)), closes [#740](https://github.com/kulshekhar/ts-jest/issues/740)
* **config:** warn instead of forcing ESM interoperability ([a2a4be2](https://github.com/kulshekhar/ts-jest/commit/a2a4be2))
* **windows:** normalize paths ([c12dfff](https://github.com/kulshekhar/ts-jest/commit/c12dfff))



<a name="23.10.0"></a>
# [23.10.0](https://github.com/kulshekhar/ts-jest/compare/v23.10.0-beta.6...v23.10.0) (2018-09-19)


### Bug Fixes

* **babel:** fixes the babel 6 hack ([c8d51cf](https://github.com/kulshekhar/ts-jest/commit/c8d51cf))
* **config:** jsx should also be considered as js files ([6c32a93](https://github.com/kulshekhar/ts-jest/commit/6c32a93))


### Features

* **hints:** warns if transform matches js without allowJs ([952cc87](https://github.com/kulshekhar/ts-jest/commit/952cc87))



<a name="23.10.0-beta.6"></a>
# [23.10.0-beta.6](https://github.com/kulshekhar/ts-jest/compare/v23.10.0-beta.5...v23.10.0-beta.6) (2018-09-13)


### Bug Fixes

* **babel:** instrumentation was done twice when using babel ([659a7fb](https://github.com/kulshekhar/ts-jest/commit/659a7fb)), closes [#713](https://github.com/kulshekhar/ts-jest/issues/713)
* **cache:** includes all parameters in cache key computing ([70e1867](https://github.com/kulshekhar/ts-jest/commit/70e1867))
* **e2e:** fixes the eval tool (not used yet) ([939d13a](https://github.com/kulshekhar/ts-jest/commit/939d13a))



<a name="23.10.0-beta.5"></a>
# [23.10.0-beta.5](https://github.com/kulshekhar/ts-jest/compare/v23.10.0-beta.4...v23.10.0-beta.5) (2018-09-12)


### Bug Fixes

* **package:** fixes the outdated package-lock ([c5a5b7a](https://github.com/kulshekhar/ts-jest/commit/c5a5b7a))


### Features

* **diagnostics:** add option to enable/disable first-TS-error-throws ([2c840c2](https://github.com/kulshekhar/ts-jest/commit/2c840c2))



<a name="23.10.0-beta.4"></a>
# [23.10.0-beta.4](https://github.com/kulshekhar/ts-jest/compare/v23.10.0-beta.3...v23.10.0-beta.4) (2018-09-06)


### Bug Fixes

* **config:** fixes a bug in the tsconfig file resolver ([3910f2c](https://github.com/kulshekhar/ts-jest/commit/3910f2c))



<a name="23.10.0-beta.3"></a>
# [23.10.0-beta.3](https://github.com/kulshekhar/ts-jest/compare/v23.10.0-beta.2...v23.10.0-beta.3) (2018-09-06)


### Bug Fixes

* **config:** fixes a bug in path resolver ([ceb0424](https://github.com/kulshekhar/ts-jest/commit/ceb0424))


### Features

* **cli:** adds a cli tool to migrate old config ([714f5f0](https://github.com/kulshekhar/ts-jest/commit/714f5f0))
* **cli:** ads a simple config:init helper + tests ([6700522](https://github.com/kulshekhar/ts-jest/commit/6700522))
* **config:** exposes custom transformers to config for presets ([885bc44](https://github.com/kulshekhar/ts-jest/commit/885bc44))
* **logger:** adds ts-jest version in the logger's context ([bb0c06e](https://github.com/kulshekhar/ts-jest/commit/bb0c06e))


### Performance Improvements

* **bundle:** improves bundle size ([34eedc3](https://github.com/kulshekhar/ts-jest/commit/34eedc3))



<a name="23.10.0-beta.2"></a>
# [23.10.0-beta.2](https://github.com/kulshekhar/ts-jest/compare/v23.10.0-beta.1...v23.10.0-beta.2) (2018-09-02)


### Bug Fixes

* **caching:** fixes a possible cache collision ([9c38694](https://github.com/kulshekhar/ts-jest/commit/9c38694))
* **testing:** change logging level for some utility ([16f125a](https://github.com/kulshekhar/ts-jest/commit/16f125a))


### Features

* **config:** typeCheck default to true (langauge service) ([623b2f4](https://github.com/kulshekhar/ts-jest/commit/623b2f4))


### BREAKING CHANGES

* **config:** Language service will be used by default from now on



<a name="23.10.0-beta.1"></a>
# [23.10.0-beta.1](https://github.com/kulshekhar/ts-jest/compare/v23.1.4...v23.10.0-beta.1) (2018-09-01)


### Bug Fixes

* **ci:** can't use runInBand for e2e: cache collision ([db650f4](https://github.com/kulshekhar/ts-jest/commit/db650f4))
* **ci:** do not run e2e sub-tests in band ([18ad865](https://github.com/kulshekhar/ts-jest/commit/18ad865))
* **ci:** ensure npm is present with ci ([edb6eda](https://github.com/kulshekhar/ts-jest/commit/edb6eda))
* **logger:** removes cyclic imports ([5ef980f](https://github.com/kulshekhar/ts-jest/commit/5ef980f))
* babel-config + adds test ([12146c3](https://github.com/kulshekhar/ts-jest/commit/12146c3))
* fixes js style to be node < 10 compatible ([83d7517](https://github.com/kulshekhar/ts-jest/commit/83d7517))
* hoisting per level + memoize fix ([31847b0](https://github.com/kulshekhar/ts-jest/commit/31847b0))
* jest 22 did not have default config ([cbaddc3](https://github.com/kulshekhar/ts-jest/commit/cbaddc3))
* makes node 6 happy ([f6f82b8](https://github.com/kulshekhar/ts-jest/commit/f6f82b8))
* makes node6 happy ([f170285](https://github.com/kulshekhar/ts-jest/commit/f170285))
* makes window happy ([36fbebe](https://github.com/kulshekhar/ts-jest/commit/36fbebe))
* node 6 unhappy again... ([703ad0b](https://github.com/kulshekhar/ts-jest/commit/703ad0b))
* normalizes bundle hash on any node version ([ce7afaf](https://github.com/kulshekhar/ts-jest/commit/ce7afaf))
* npm coming with node 6 doesn't talk `ci` ([b87198d](https://github.com/kulshekhar/ts-jest/commit/b87198d))
* source maps ([89a30c9](https://github.com/kulshekhar/ts-jest/commit/89a30c9))
* typos + node 6 compat ([0ed1587](https://github.com/kulshekhar/ts-jest/commit/0ed1587))
* updates templates ([f2e1da2](https://github.com/kulshekhar/ts-jest/commit/f2e1da2))
* uses cross-platform spawn + fix pkg versions ([ac1599c](https://github.com/kulshekhar/ts-jest/commit/ac1599c))
* we are not writing files, use normalized EOL ([47fff43](https://github.com/kulshekhar/ts-jest/commit/47fff43))
* **tests:** CI fixes ([34a41ea](https://github.com/kulshekhar/ts-jest/commit/34a41ea))
* **tests:** detect npm version to use or not ci ([683a1e5](https://github.com/kulshekhar/ts-jest/commit/683a1e5))
* **tests:** do not use babel in our tests + new API for simple ([3e4de3e](https://github.com/kulshekhar/ts-jest/commit/3e4de3e))
* **tests:** more sanitizing for windows compat ([faae274](https://github.com/kulshekhar/ts-jest/commit/faae274))


### Features

* **config:** adds a helper to build moduleNameMapper from paths ([7b8598e](https://github.com/kulshekhar/ts-jest/commit/7b8598e)), closes [#364](https://github.com/kulshekhar/ts-jest/issues/364)
* **logging:** improves log messages + tests ([5d03c4d](https://github.com/kulshekhar/ts-jest/commit/5d03c4d))
* adds logging + better hashing ([4322701](https://github.com/kulshekhar/ts-jest/commit/4322701))
* allow env var to add diagnostic codes to ignore ([777edf5](https://github.com/kulshekhar/ts-jest/commit/777edf5))
* cache key + tests ([bd55448](https://github.com/kulshekhar/ts-jest/commit/bd55448))
* diagnostics, different compilers, ... ([f26ebf0](https://github.com/kulshekhar/ts-jest/commit/f26ebf0))
* directly writes to stdio so jest does not swallow ([6a7f01f](https://github.com/kulshekhar/ts-jest/commit/6a7f01f))
* handles stringifyContentPathRegex ([3fcb4bd](https://github.com/kulshekhar/ts-jest/commit/3fcb4bd))
* hoisting + tests + many other things ([6186e84](https://github.com/kulshekhar/ts-jest/commit/6186e84))
* io serializer + other test utils ([d03e0e7](https://github.com/kulshekhar/ts-jest/commit/d03e0e7))
* jest preset ([beb50b5](https://github.com/kulshekhar/ts-jest/commit/beb50b5))
* warn about unsupported versions ([1103071](https://github.com/kulshekhar/ts-jest/commit/1103071))
* **test:** jest serializers ([dfa9c0f](https://github.com/kulshekhar/ts-jest/commit/dfa9c0f))
* **tests:** more test tools + adds test related to debuggin issues ([8dcafca](https://github.com/kulshekhar/ts-jest/commit/8dcafca))


### Performance Improvements

* **babel:** uses babel-jest cache key as part of ours ([f51c4a7](https://github.com/kulshekhar/ts-jest/commit/f51c4a7))
* **cache:** share config-sets for parallel test running ([090ca7b](https://github.com/kulshekhar/ts-jest/commit/090ca7b))
* **tests:** run e2e tests in band ([b3e94ff](https://github.com/kulshekhar/ts-jest/commit/b3e94ff))
* detects changes in templates and bundle ([2a3da21](https://github.com/kulshekhar/ts-jest/commit/2a3da21))
* do not type check if fileName doesn't match ([cc45adc](https://github.com/kulshekhar/ts-jest/commit/cc45adc))
* faster tests ([37a0187](https://github.com/kulshekhar/ts-jest/commit/37a0187))
* improves speed of local test after 1st run ([cc04021](https://github.com/kulshekhar/ts-jest/commit/cc04021))
* more cleaning ([c48f7b8](https://github.com/kulshekhar/ts-jest/commit/c48f7b8))
* trying to improve travis-ci conf ([e4b4d95](https://github.com/kulshekhar/ts-jest/commit/e4b4d95))



<a name="23.1.3"></a>
## [23.1.3](https://github.com/kulshekhar/ts-jest/compare/v23.1.2...v23.1.3) (2018-08-06)


### Bug Fixes

* allow (but deprecate) use of old preprocessor.js ([a65079f](https://github.com/kulshekhar/ts-jest/commit/a65079f))
* big refactor + fixes (mainly cache key + coverage) ([e46caae](https://github.com/kulshekhar/ts-jest/commit/e46caae))
* fixes coverage and tests ([09500c2](https://github.com/kulshekhar/ts-jest/commit/09500c2))
* gracefully load [@babel](https://github.com/babel)/core or babel-core ([98b2410](https://github.com/kulshekhar/ts-jest/commit/98b2410))
* hack for babel < 6 so that breakpoints do work ([90c74ef](https://github.com/kulshekhar/ts-jest/commit/90c74ef)), closes [#627](https://github.com/kulshekhar/ts-jest/issues/627)
* resolves correctly config file path (fix [#636](https://github.com/kulshekhar/ts-jest/issues/636)) ([5ab100c](https://github.com/kulshekhar/ts-jest/commit/5ab100c))
* test rootDir to handle preset-angular ([8a6a8f7](https://github.com/kulshekhar/ts-jest/commit/8a6a8f7))
* wrong error message ([c955083](https://github.com/kulshekhar/ts-jest/commit/c955083))
* **html:** correctly transforms html source when needed ([9a2d74f](https://github.com/kulshekhar/ts-jest/commit/9a2d74f))
* **lint:** fixes tslint script & lint issues ([60ab36e](https://github.com/kulshekhar/ts-jest/commit/60ab36e))
* **package:** update fs-extra to version 6.0.1 ([7e73536](https://github.com/kulshekhar/ts-jest/commit/7e73536))
* **package:** update pkg-dir to version 3.0.0 ([3fb8f9f](https://github.com/kulshekhar/ts-jest/commit/3fb8f9f))
* **package:** update yargs to version 12.0.1 ([390ffcd](https://github.com/kulshekhar/ts-jest/commit/390ffcd))
* **source-maps:** fix source maps options/calls ([76e27c1](https://github.com/kulshekhar/ts-jest/commit/76e27c1))
* Typo in utils.ts ([#534](https://github.com/kulshekhar/ts-jest/issues/534)) ([a650260](https://github.com/kulshekhar/ts-jest/commit/a650260))


### Performance Improvements

* do not hash cache key, jest does it underneath ([fbe4f1f](https://github.com/kulshekhar/ts-jest/commit/fbe4f1f))



<a name="22.4.5"></a>
## [22.4.5](https://github.com/kulshekhar/ts-jest/compare/v22.4.4...v22.4.5) (2018-05-05)



<a name="22.4.1"></a>
## [22.4.1](https://github.com/kulshekhar/ts-jest/compare/v22.4.0...v22.4.1) (2018-03-02)


### Bug Fixes

* **package:** update source-map-support to version 0.5.0 ([f0aab12](https://github.com/kulshekhar/ts-jest/commit/f0aab12))
* **package:** update yargs to version 10.0.3 ([5cdf969](https://github.com/kulshekhar/ts-jest/commit/5cdf969))
* **package:** update yargs to version 11.0.0 ([7e9ce40](https://github.com/kulshekhar/ts-jest/commit/7e9ce40))
* add startDir to if-clause ([eed5311](https://github.com/kulshekhar/ts-jest/commit/eed5311))
* **package:** update yargs to version 9.0.1 ([#326](https://github.com/kulshekhar/ts-jest/issues/326)) ([8bf9924](https://github.com/kulshekhar/ts-jest/commit/8bf9924))


### Features

* add option to run TypeScript diagnostics ([13b77d9](https://github.com/kulshekhar/ts-jest/commit/13b77d9))



<a name="21.0.1"></a>
## [21.0.1](https://github.com/kulshekhar/ts-jest/compare/v21.0.0...v21.0.1) (2017-09-14)



<a name="21.0.0"></a>
# [21.0.0](https://github.com/kulshekhar/ts-jest/compare/v20.0.14...v21.0.0) (2017-09-05)



<a name="20.0.14"></a>
## [20.0.14](https://github.com/kulshekhar/ts-jest/compare/v20.0.13...v20.0.14) (2017-09-01)



<a name="20.0.13"></a>
## [20.0.13](https://github.com/kulshekhar/ts-jest/compare/v20.0.12...v20.0.13) (2017-08-30)



<a name="20.0.12"></a>
## [20.0.12](https://github.com/kulshekhar/ts-jest/compare/v20.0.11...v20.0.12) (2017-08-30)



<a name="20.0.11"></a>
## [20.0.11](https://github.com/kulshekhar/ts-jest/compare/v20.0.9...v20.0.11) (2017-08-29)



<a name="20.0.9"></a>
## [20.0.9](https://github.com/kulshekhar/ts-jest/compare/20.0.9...v20.0.9) (2017-08-04)


### Bug Fixes

* **package:** update fs-extra to version 4.0.0 ([5be18fb](https://github.com/kulshekhar/ts-jest/commit/5be18fb))



<a name="20.0.7"></a>
## [20.0.7](https://github.com/kulshekhar/ts-jest/compare/17.0.3...20.0.7) (2017-07-07)


### Bug Fixes

* peer dependency against Typescript 2.x ([cb08128](https://github.com/kulshekhar/ts-jest/commit/cb08128))
* remove outDir when collecting coverage ([c076956](https://github.com/kulshekhar/ts-jest/commit/c076956))
* **package:** update fs-extra to version 3.0.0 ([906be12](https://github.com/kulshekhar/ts-jest/commit/906be12))
* **package:** update yargs to version 8.0.1 ([0b2ea98](https://github.com/kulshekhar/ts-jest/commit/0b2ea98))


### Features

* export transpileIfTypescript ([6f835af](https://github.com/kulshekhar/ts-jest/commit/6f835af))



<a name="17.0.3"></a>
## [17.0.3](https://github.com/kulshekhar/ts-jest/compare/17.0.2...17.0.3) (2016-12-01)



<a name="17.0.2"></a>
## [17.0.2](https://github.com/kulshekhar/ts-jest/compare/17.0.1...17.0.2) (2016-12-01)



<a name="17.0.1"></a>
## [17.0.1](https://github.com/kulshekhar/ts-jest/compare/17.0.0...17.0.1) (2016-11-30)



<a name="17.0.0"></a>
# [17.0.0](https://github.com/kulshekhar/ts-jest/compare/0.1.13...17.0.0) (2016-11-09)



<a name="0.1.13"></a>
## [0.1.13](https://github.com/kulshekhar/ts-jest/compare/0.1.12...0.1.13) (2016-11-07)



<a name="0.1.12"></a>
## [0.1.12](https://github.com/kulshekhar/ts-jest/compare/0.1.11...0.1.12) (2016-11-03)



<a name="0.1.11"></a>
## [0.1.11](https://github.com/kulshekhar/ts-jest/compare/0.1.10...0.1.11) (2016-10-27)



<a name="0.1.10"></a>
## [0.1.10](https://github.com/kulshekhar/ts-jest/compare/0.1.9...0.1.10) (2016-10-26)



<a name="0.1.9"></a>
## [0.1.9](https://github.com/kulshekhar/ts-jest/compare/0.1.8...0.1.9) (2016-10-24)



<a name="0.1.8"></a>
## [0.1.8](https://github.com/kulshekhar/ts-jest/compare/0.1.7...0.1.8) (2016-10-14)



<a name="0.1.7"></a>
## [0.1.7](https://github.com/kulshekhar/ts-jest/compare/0.1.6...0.1.7) (2016-10-10)



<a name="0.1.6"></a>
## [0.1.6](https://github.com/kulshekhar/ts-jest/compare/0.1.5...0.1.6) (2016-10-08)



<a name="0.1.5"></a>
## [0.1.5](https://github.com/kulshekhar/ts-jest/compare/0.1.4...0.1.5) (2016-09-22)



<a name="0.1.4"></a>
## [0.1.4](https://github.com/kulshekhar/ts-jest/compare/0.1.3...0.1.4) (2016-09-16)



<a name="0.1.3"></a>
## [0.1.3](https://github.com/kulshekhar/ts-jest/compare/0.1.2...0.1.3) (2016-08-31)



<a name="0.1.2"></a>
## [0.1.2](https://github.com/kulshekhar/ts-jest/compare/0.1.1...0.1.2) (2016-08-31)



<a name="0.1.1"></a>
## [0.1.1](https://github.com/kulshekhar/ts-jest/compare/0.1.0...0.1.1) (2016-08-31)



<a name="0.1.0"></a>
# [0.1.0](https://github.com/kulshekhar/ts-jest/compare/0.0.1...0.1.0) (2016-08-31)



<a name="0.0.1"></a>
## [0.0.1](https://github.com/kulshekhar/ts-jest/compare/0.0.0...0.0.1) (2016-08-30)



<a name="0.0.0"></a>
# 0.0.0 (2016-08-30)



