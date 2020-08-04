# Changelog

## v6.2.1
* [Output types alongside JS files, enable declaration maps](https://github.com/TypeStrong/ts-loader/pull/1026) - thanks @meyer!

## v6.2.0
* [Emitting .tsbuildinfo when using watch api](https://github.com/TypeStrong/ts-loader/pull/1017) - thanks @sheetalkamat!

## v6.1.2
* [don't emit declaration files for a declaration file](https://github.com/TypeStrong/ts-loader/pull/1015) (#1014) - thanks @gvinaccia!
* [Consume typescript apis from typescript nightly](https://github.com/TypeStrong/ts-loader/pull/1016) - thanks @sheetalkamat!

## v6.1.1
* [Fix SolutionBuilder watches](https://github.com/TypeStrong/ts-loader/pull/1003) and [related fixes](https://github.com/TypeStrong/ts-loader/pull/1011) (#998) - thanks @sheetalkamat!
* [fix: no errors reported if flagged with @ts-check](https://github.com/TypeStrong/ts-loader/pull/1008) (#1004) - thanks @reinholdk!

## v6.1.0
* [Build upstream project references with SolutionBuilder](https://github.com/TypeStrong/ts-loader/pull/935) (#851, #913) - thanks @sheetalkamat!

## v6.0.4
* [Fix issue when handling files not included in tsconfig.json](https://github.com/TypeStrong/ts-loader/issues/943) (#934) - thanks @davazp!

## v6.0.3
* [Upgrade typescript version to 3.5.2](https://github.com/TypeStrong/ts-loader/pull/954) (#954) - thanks @fa93hws

## v6.0.2
* [Set configFilePath when reading config file](https://github.com/TypeStrong/ts-loader/pull/942) (#939) - thanks @konpikwastaken!

## v6.0.1

* [Fix issue with `resolveTypeReferenceDirective` causing errors like `Cannot find name 'it'` with Jest](https://github.com/TypeStrong/ts-loader/pull/936) (#934) (#919) - thanks @andrewbranch!
* [Fix TypeScript diagnostics not being printed to console when using project references](https://github.com/TypeStrong/ts-loader/pull/937) (#932) - thanks @andrewbranch!

## v6.0.0

* [Drop support for node < 8.6 related to micromatch upgrade to 4](https://github.com/TypeStrong/ts-loader/pull/930); see: https://github.com/TypeStrong/ts-loader/issues/929
* [Update dependencies](https://github.com/TypeStrong/ts-loader/pull/928) - thanks @johnnyreilly!

## v5.4.5

* [use @types/webpack for loader typings](https://github.com/TypeStrong/ts-loader/pull/927) - thanks @LukeSheard!

## v5.4.4

* [refactor: add common appendTsTsxSuffixesIfRequired function to instance](https://github.com/TypeStrong/ts-loader/pull/924) - thanks @johnnyreilly!

## v5.4.3

* [feat: resolveTypeReferenceDirective support for yarn PnP](https://github.com/TypeStrong/ts-loader/pull/921) - thanks @johnnyreilly!
* [fix: don't include anything apart from ts-loader in publish](https://github.com/TypeStrong/ts-loader/pull/923) - thanks @johnnyreilly!

## v5.3.3

* [fix: Pass ts.Program to getCustomTransformers](https://github.com/TypeStrong/ts-loader/pull/889) (#860) - thanks @andersekdahl!

## v5.3.2

* [feat: enable experimentalFileCaching by default](https://github.com/TypeStrong/ts-loader/pull/885) (#868) - thanks @timocov!

## v5.3.1

* [fix: projectReferences with rootDir](https://github.com/TypeStrong/ts-loader/pull/871) (#868) - thanks @andrewbranch!

## v5.3.0

* [feat: Exposes a `resolveNodeModule` option](https://github.com/TypeStrong/ts-loader/pull/862) - thanks @arcanis!

## v5.2.2

* [feat: Micro-optimizations](https://github.com/TypeStrong/ts-loader/pull/855) - thanks @johnnyreilly

## v5.2.1

* [feat: Lists typescript as a peer dependency](https://github.com/TypeStrong/ts-loader/pull/841) - thanks @arcanis!

## v5.2.0

* [feat: Initial support for project references - `projectReferences`](https://github.com/TypeStrong/ts-loader/pull/817) - thanks @andrewbranch!

## v5.1.1

* [fix(getTranspilationEmit): pass the raw path to transpileModule](https://github.com/TypeStrong/ts-loader/pull/835) - thanks @Brooooooklyn

## v5.1.0

* [feat: Added cache for some FS operations while compiling - `experimentalFileCaching`](https://github.com/TypeStrong/ts-loader/pull/829) - thanks @timocov!

## v5.0.0

* [feat: Fixed issue with incorrect output path for declaration files](https://github.com/TypeStrong/ts-loader/pull/822) - thanks @JonWallsten! **BREAKING CHANGE**

## v4.5.0

* [feat: Added support for TypeScript declaration map](https://github.com/TypeStrong/ts-loader/pull/821) - thanks @JonWallsten!

## v4.4.2

* [fix(loader): new Error to webpack when errors occured in the loader function](https://github.com/TypeStrong/ts-loader/pull/792) - thanks @linxiaowu66 and @systemmetaphor!

## v4.4.1

* [fix(types): expose public interfaces from root index.d.ts](https://github.com/TypeStrong/ts-loader/pull/790) - thanks @Hotell!

## v4.4.0

* [feat: generate ambient types from implementation](https://github.com/TypeStrong/ts-loader/pull/788) - thanks @Hotell!
* [error when not using webpack 4](https://github.com/TypeStrong/ts-loader/pull/786) - thanks @johnnyreilly

## v4.3.1

* [Fix options caching when ts-loader is used in multiple rules](https://github.com/TypeStrong/ts-loader/pull/782) - thanks @yyx990803!

Please note, this bug fix requires that vue-loader users still using v14 should either upgrade to v15 or explicitly pass the same ts-loader options via v14's loaders option.  [See more details here](https://github.com/TypeStrong/ts-loader/pull/782#issuecomment-394406093)

## v4.3.0

* [Fix dependency resolution when using pnpm](https://github.com/TypeStrong/ts-loader/pull/774) - thanks @xbtsw and @zkochan!
* [Add `allowTsInNodeModules` option for importing .ts files from node_modules](https://github.com/TypeStrong/ts-loader/pull/773) - thanks @aelawson!

## v4.2.0

* [Pass `context' to error formatters](https://github.com/TypeStrong/ts-loader/pull/756) - thanks @gustavderdrache!

## v4.1.0

* [Fix slow `experimentalWatchApi`](https://github.com/TypeStrong/ts-loader/pull/747) (#746) - thanks @sheetalkamat and @MLoughry!
* [feat: `getCustomTransformers` support path string for a module](https://github.com/TypeStrong/ts-loader/pull/745) - thanks @vagusX and @s-panferov (upon whose work this is based I believe)

## v4.0.1

* [Fix name collision in experimentalWatchApi code](https://github.com/TypeStrong/ts-loader/pull/737) - thanks @MLoughry!

## v4.0.0

* Support webpack 4
* Drop support for webpack 2/3 **BREAKING CHANGE** - use ts-loader 3.x if you need webpack 2/3 support
* Minimum TypeScript version is now 2.4.1 **BREAKING CHANGE**
* Deprecated option `entryFileCannotBeJs` removed' **BREAKING CHANGE**
* Start using [prettier](https://prettier.io/) for the codebase

## v3.5.0

* [Add trace for traceResolution](https://github.com/TypeStrong/ts-loader/pull/721) - thanks @onigoetz!

## v3.4.0

* [local .d.ts files now marked as changed when watch is triggered](https://github.com/TypeStrong/ts-loader/pull/698) - thanks @KnisterPeter!

## v3.3.1

* [Fixes to support watch api for compiling - lib support etc](https://github.com/TypeStrong/ts-loader/pull/715) - thanks @sheetalkamat!

## v3.3.0

* [Report diagnostics only on certain files with `reportFiles` option](https://github.com/TypeStrong/ts-loader/pull/701) - thanks @freeman!
* [Replaced option `contextAsConfigBasePath` with `context` option.](https://github.com/TypeStrong/ts-loader/pull/688/) Strictly speaking a breaking change. However, given the original option was never able to fulfil its intended purpose I've decided to treat this as just a new feature; there seems no possibility that anyone can be using `contextAsConfigBasePath` - thanks @christiantinauer!
* [Added support for the new watch api of TypeScript compiler.](https://github.com/TypeStrong/ts-loader/pull/685) nb This feature has been placed behind a new `experimentalWatchApi` option until it has been thoroughly tested. All being well it is likely to become the default behaviour for ts-loader in future - thanks @sheetalkamat!

## v3.2.0

* [Add new loader option `contextAsConfigBasePath`](https://github.com/TypeStrong/ts-loader/pull/681) - thanks @christiantinauer

## v3.1.1

* [Fix error importing buildt ts files with allowJs](https://github.com/TypeStrong/ts-loader/pull/674) (#667) - thanks @Pajn!

## v3.1.0

* [Add `onlyCompileBundledFiles` option which modifies behaviour to load only those files that are actually bundled by webpack](https://github.com/TypeStrong/ts-loader/pull/671) #267 - thanks @maier49!
* [Chore release; upgraded chalk dependency in `package.json` to 2.3, as 2.3 is another breaking changes release (from a TypeScript perspective).](https://github.com/TypeStrong/ts-loader/issues/664), see [here](https://github.com/chalk/chalk/issues/215) for context - thanks @johnnyreilly

## v3.0.5

* [Chore release; upgraded chalk dependency in `package.json` to 2.2, as 2.2 appears to be a breaking changes release.](https://github.com/TypeStrong/ts-loader/issues/664) - thanks @lmk123 for reporting

## v3.0.4

* [Chore release; upgraded chalk dependency.](https://github.com/TypeStrong/ts-loader/pull/662) - thanks @johnnyreilly

## v3.0.3

* [Fix allowJs @types resolution error](https://github.com/TypeStrong/ts-loader/pull/658) (#657, #655) - thanks @johnnyreilly and @roddypratt + @ldrick for providing minimal repro repos which allowed me to fix this long standing bug!

This fix resolves the issue for TypeScript 2.4+ (which is likely 95% of users). For those people stuck on 2.3 or below and impacted by this issue, you should be able to workaround this by setting `entryFileCannotBeJs: true` in your ts-loader options. This option should be considered deprecated as of this release. The option will likely disappear with the next major version of ts-loader which will drop support for TypeScript 2.3 and below, thus removing the need for this option.

## v3.0.0

All changes were made with this [PR](https://github.com/TypeStrong/ts-loader/pull/643) - thanks @johnnyreilly

([Published to npm as v3.0.2 due to npm publishing issues](https://github.com/TypeStrong/ts-loader/issues/654)) thanks @mattlewis92 for noticing!

* drop support for typescript < 2.0 (no-one seems to be using it and we can simplify the code) **BREAKING CHANGE**
* remove `entryFileIsJs` option; it can be inferred from whether the `allowJs` TypeScript compiler option has been set.
* move to webpack 3.0 for test harness
* drop `configFileName` support [(replaced by `configFile`)](https://github.com/TypeStrong/ts-loader/pull/607) **BREAKING CHANGE**
* add support for a custom formatter for output - drop visual studio format (this can be added back if there's clamour for it and people can supply their own formatters in the interim) **BREAKING CHANGE**
* make loglevel warn by default (stop outputting typescript version number by default). Fixes [#488](https://github.com/TypeStrong/ts-loader/issues/488)
* fix [tsc has "module" default to "es2015"when targetting es2015+, but ts-loader does not](https://github.com/TypeStrong/ts-loader/issues/570) - thanks [@Venryx](https://github.com/Venryx) for the suggestion!
* [switch to build ts-loader / run tests with yarn](https://github.com/TypeStrong/ts-loader/issues/369) because of [this](https://stackoverflow.com/questions/45022048/why-does-npm-install-rewrite-package-lock-json/45566871#45566871)
* allow controlling whether the output can contain colours

## v2.3.7

* [Start validating the options supplied to the loader](https://github.com/TypeStrong/ts-loader/pull/630) (#629) - thanks @johnnyreilly!

## v2.3.6

* [Fix kills ts-loader dependant builds issue](https://github.com/TypeStrong/ts-loader/pull/627) (#626) - thanks @Loilo!

## v2.3.5

* [Add an additional check for js files before reusing isExternalLibaryImport](https://github.com/TypeStrong/ts-loader/pull/622) (#620) - thanks @WillMartin!
* [Make TypeScript `basePath` configurable](https://github.com/TypeStrong/ts-loader/pull/621) (#618) - thanks @Loilo!
* [Fix relative configFile path](https://github.com/TypeStrong/ts-loader/pull/618) (#617) - thanks @Loilo!

## v2.3.4

* [Add `configFile` option](https://github.com/TypeStrong/ts-loader/pull/607) - thanks @Loilo!

## v2.3.3

* [fix(tsconfig): stop passing rootDir option to TypeScript compiler](https://github.com/TypeStrong/ts-loader/pull/598) (#597) - thanks @Brooooooklyn
* [Fix findConfigFile in Windows](https://github.com/TypeStrong/ts-loader/pull/605) (#604) - thanks @mengxy

## v2.3.2

* [Move to use strictNullChecks](https://github.com/TypeStrong/ts-loader/pull/589) - thanks @johnnyreilly
* [`allowJs` supports importing types from external libraries](https://github.com/TypeStrong/ts-loader/pull/590) (#586, #577) - thanks @bsouthga!

## v2.3.1

* [Fix undefined watcher in watch-run causes error](https://github.com/TypeStrong/ts-loader/pull/587) (#585) - thanks @zinserjan and @sokra!

## v2.3.0

* [add appendTsxSuffixTo option to support using tsx with Vue](https://github.com/TypeStrong/ts-loader/pull/581) - lots of discussion went into this PR. Thanks to @vhqtvn (author) and @HerringtonDarkholme, @johnnyreilly, @jbrantly, @octref, @rhyek and others for helping us land on our final implementation.
* [refactor: Use chalk instead of colors](https://github.com/TypeStrong/ts-loader/pull/579) - thanks @develar!

## v2.2.2

* [Remove default of setting isolatedModules to true when in transpileOnly mode](https://github.com/TypeStrong/ts-loader/pull/569) - thanks @johnnyreilly and @donaldpipowitch

## v2.2.1

* [Report errors in JS(X) files when CheckJS is enabled](https://github.com/TypeStrong/ts-loader/pull/564) - thanks @schmuli!
* [Cater for change to @types acquisition strategy in TypeScript 2.4.1](https://github.com/TypeStrong/ts-loader/pull/566) - thanks @johnnyreilly

## v2.2.0

* [Support custom transformers for ts](https://github.com/TypeStrong/ts-loader/pull/535) - thanks @longlho and @Igorbek!

## v2.1.0

* [Add happypack compatibility mode](https://github.com/TypeStrong/ts-loader/pull/547) - thanks @aindlq!

## v2.0.3

* [Don't include appended TS extension in webpack dependencies](https://github.com/TypeStrong/ts-loader/pull/497) - thanks again @wearymonkey!

## v2.0.2

* [Fix performance regression related to using getTimes() by tracking timestamps](https://github.com/TypeStrong/ts-loader/pull/500) - thanks @wearymonkey

## v2.0.1

* [make watch resilient to no watcher / watcher.mtimes](https://github.com/TypeStrong/ts-loader/pull/482) - thanks @bancek and @mredbishop
* [move to using loader-utils 1.0](https://github.com/TypeStrong/ts-loader/pull/475)

## v2.0.0

* [Add support for IgnoringWatchFileSystem](https://github.com/TypeStrong/ts-loader/pull/444) - thanks @herschel666
* [Use native Object.assign()](https://github.com/TypeStrong/ts-loader/pull/418) - thanks @arusakov

Breaking changes:

* ts-loader now officially only supports webpack 2. ts-loader 2.x may work with webpack 1 but it is not supported. Related to that, all continuous integration tests now run against webpack 2.
* as webpack 2 does not support node 0.12 neither does ts-loader from now. node 4 at least is required.

## v1.3.3

* [Fix bug when "extend"ing a tsconfig that specifies "allowJs"](https://github.com/TypeStrong/ts-loader/pull/415) Thanks @cspotcode
* [Minor perf optimisations](https://github.com/TypeStrong/ts-loader/pull/412)

## v1.3.2

* [Upgrade enhanced-resolve to v3](https://github.com/TypeStrong/ts-loader/pull/411)
* [Remove arrify dependency](https://github.com/TypeStrong/ts-loader/pull/410)

## v1.3.1

* [Rolled back re-exported const enums no longer break emit in watch mode as performance cost was too high](https://github.com/TypeStrong/ts-loader/pull/406) resolves #393

## v1.3.0

* [Introduce meaningful error when importing TypeScript from `node_modules`](https://github.com/TypeStrong/ts-loader/pull/399)
* [Introduce `entryFileIsJs` loader option which allows having an entry file which is js.](https://github.com/TypeStrong/ts-loader/pull/399) resolves #388 and #401 - thanks @Wykks and @pqr.

NB Previously the `entryFileIsJs` option was on by default when `allowJs` was true. Now it has to be specified directly. Strictly speaking this is a breaking change; however given this is a rarely used option which exists for what is arguably an edge case this is being added without moving to 2.0. If this breaks people then we'll never do this again; I'd be surprised if anyone is relying on this though so we're taking a chance. Related tests have been suffixed "-entryFileIsJs" in the test name.

## v1.2.2

* [Re-exported const enums no longer break emit in watch mode](https://github.com/TypeStrong/ts-loader/pull/377) [#376] - thanks @smphhh
* [typescript.sys should be compiler.sys](https://github.com/TypeStrong/ts-loader/pull/380) [#379] - thanks @johnnyreilly and @jbrantly

## v1.2.1

* [Fix TS module resolution paths on Windows - watch mode becomes faster](https://github.com/TypeStrong/ts-loader/pull/373) [#372] - thanks @smphhh

## v1.2.0

* [Crash when adding/removing files in watch-mode](https://github.com/TypeStrong/ts-loader/pull/364) [#358] - thanks @jbbr for the suggested fix
* [Provided an option to produce Visual Studio compatible error output](https://github.com/TypeStrong/ts-loader/pull/356) [#355] - thanks @gamli

## v1.1.0

* [Added support for vuejs via `appendTsSuffixTo` option](https://github.com/TypeStrong/ts-loader/pull/354) [#270] - thanks @HerringtonDarkholme

## v1.0.0

* [General refactor of ts-loader; some performance improvements](https://github.com/TypeStrong/ts-loader/pull/343) [#335] - thanks @johnnyreilly
* [Make the loader resilient to watched declaration files being removed.](https://github.com/TypeStrong/ts-loader/pull/281) - thanks @opichals

## v0.9.5

* [Improve performance for watch mode / `after-compile` plugin](https://github.com/TypeStrong/ts-loader/pull/187) - thanks @Strate

## v0.9.4

* [Make logging to stderr or stdout configurable; introduce logging levels](https://github.com/TypeStrong/ts-loader/pull/313) [#214] - thanks @ThYpHo0n
* [Fix regression that broke hot module replacement](https://github.com/TypeStrong/ts-loader/pull/322) [#321] - thanks @dopare

## v0.9.3

* [Added support for allowJs](https://github.com/TypeStrong/ts-loader/pull/320) (#316) - thanks @dschnare

## v0.9.2

* [Added support for @types](https://github.com/TypeStrong/ts-loader/pull/318) (#247) -thanks @basarat for the ideas

## v0.9.1

* [Normalize dependency graph paths - Fix broken dependencies on Windows ](https://github.com/TypeStrong/ts-loader/pull/286) - thanks @pzavolinsky
* [Fixed the declaration issue](https://github.com/TypeStrong/ts-loader/pull/307) (#214 part deux) - thanks @dizel3d

## v0.9.0

* [Made ts-loader compatible with node v6](https://github.com/TypeStrong/ts-loader/commit/a4f835345e495f45b40365f025afce72d1817996) - thanks @Blechhirn
* [Fixed the declaration issue](https://github.com/TypeStrong/ts-loader/commit/3bb0fec73a2fab47953b51d256f0f5378f236ad1) (#214) - thanks @17cupsofcoffee
* [Declarations update independent of compiler.watchFileSystem](https://github.com/TypeStrong/ts-loader/pull/167/commits/ae824b2676b226bdd0c860a787754a4ae28e339c) (#155) - thanks @opichals

Now built using TypeScript v2.0

## v0.8.2

* Elided imports are now watched (#156, #169)
* Declaration files for `.d.ts` files are now emitted (thanks @rob-bateman) (#174, #175)

## v0.8.1

* Add better error messaging when a file in tsconfig.json can not be loaded (#117, #145)
* Fix incompatibility with html-webpack-plugin (#152, #154)

## v0.8.0

* Add support for emitting declaration files when `declaration: true` is set (#48, #128)
* Fix bug with specifying `target: es6` and `module: commonjs` at the same time when using
  TS 1.7+ (#111, #132, #140).
* Fix bug with resolving dependencies which are linked using `npm link` (#134, #141)

## v0.7.2

* Fix regression with watching definition files (#109, #110)

## v0.7.1

* Fix regression with Windows that was introduced in v0.7.0 (#92)

## v0.7.0

* Fix bug with webpack resolution that could sometimes cause TypeScript to not find modules (#92, #102)
* Loader output is now written to stderr instead of stdout. (#95, #103)

## v0.6.1

* Improve initial build performance significantly for larger projects (#100)
* Fix issue with nightly (#96)

## v0.6.0

* Remove support for 1.5 and 1.6-beta. TypeScript 1.6 (stable) is the now the lowest version
  supported.
* Fix issue when using source maps and Babel in certain situations (#81)
* Fix issue with nightly (#83)

## v0.5.6

* Add ignoreDiagnostics feature
* Fix issue with node resolution and `noEmitOnError` (#71)

## v0.5.5

* Fix issue with nightly (Microsoft/TypeScript#4738)
* Add support for the NoErrorsPlugin

## v0.5.4

* Fix issue with nightly (Microsoft/TypeScript#4497)

## v0.5.3

* Utilize TypeScript's new custom module resolution logic to integrate with webpack. This essentially
  means that TypeScript will resolve files exactly the same as webpack does (supporting aliases, etc).
  See the [aliasResolution test](test/aliasResolution) for an example. Only supported in TS 1.6 and
  above.
* Rework error reporting to resolve certain edge cases with dependencies. In general errors should
  be much more consistent now in watch mode.
* Fix issue with targeting ES6 and transpile mode (#36)

## v0.5.2

* Fix issue with TypeScript nightly and new node module resolution strategy (#34)

## v0.5.1

* Tweaked error message output to include error code (#32)
* Add helpful messages around the TypeScript dependency
  * Suggest how to install TypeScript if it hasn't been installed
  * Show TypeScript version when compiling
  * Warn if TypeScript version is incompatible

## v0.5.0

* Add support for `transpileOnly` loader option. See README for more information.
* TypeScript is no longer a dependency of the loader and must be installed separately
* Loader options can now be set as a property in `webpack.config.js`
* TypeScript options can be set through the loader option `compilerOptions`
* Improved error reporting
  * Errors from all files in the TypeScript application are now reported in watch mode instead of
    from just those files that changed. This means that making a breaking change in a dependency
    will now be correctly reported as an error in the dependent file.
  * Errors with TypeScript options are now reported as webpack errors instead of logged to console
  * Error output no longer contains the filename once from webpack and again in the error message.
    Instead, the filename is only reported by webpack
  * Fixed issue with latest version of webpack where filenames could be reported twice for the same
    error in certain situations
* Using the `declaration` TypeScript option no longer results in errors
* Add support for the `newLine` TypeScript option
* Tests have been revamped to be full integration tests with nightly builds against the current stable
  and nightly TypeScript. Many new tests have been added.

## v0.4.7

* Update TypeScript dependency to 1.5 release (1.5.3)

## v0.4.6

* Improve error reporting related to tsconfig.json
  * Fix bug that reported the wrong errors
  * Errors are now reported as webpack errors instead of logged to console
* Add support for latest TypeScript nightly (#24)

## v0.4.5

* Add `silent` flag (#22)

## v0.4.4

* Add support for "noLib" compiler option (#19)
* Make errors easier to parse programmatically (#20)
  * Errors in declaration files are now added to the stats object instead of written to console
  * Errors now include `file`, `rawMessage`, and `location` properties
* Make --watch option more robust
  * Fix issue where changes to entry file were not detected
  * Fix issue where changes to typing information only did not result in a rebuild (#21)

## v0.4.3

* Fix error locations to be 1-based instead of 0-based (#18)

## v0.4.2

* Rework the way dependencies are loaded (#14)
* Fix NPM dependency on TypeScript (#15, #16)

## v0.4.1

* Fix Windows issue with paths (#14)

## v0.4.0

* TypeScript 1.5 support! (#14)
* tsconfig.json support (#2, #9)
* ES6 target support
* Remove TS-related options in favor of specifying them in tsconfig.json
* Add `configFileName` option for custom tsconfig files

## v0.3.4

* Exclude TS 1.5 as a dependency since there are breaking changes

## v0.3.3

* Add support for reporting errors in declaration files (#10)
* Add support for watch mode for declaration files (#11)
* Fix issue with extra `sourceMappingURL` in output files (#12)

## v0.3.2

* Add support for manually adding files (#6)
* Add paths to source maps (#8)

## v0.3.1

* Add support for specifying a custom TypeScript compiler

## v0.3.0

* Change how modules are resolved. Imports and declaration file references are
  now resolved through TypeScript instead of being resolved through webpack's
  `resolve` API. This fixes a number of issues and better aligns the loader to
  work as a replacement for the `tsc` command. (#3, #4, #5)

## v0.2.3

* Add noImplicitAny option (#2)

## v0.2.2

* Fix issue with source maps

## v0.2.1

* Add colors to error output

## v0.2.0

* Add new configuration options (#1)
  * target, module, sourceMap, instance
  * sourceMap default changed from `true` to `false`
* Workaround issue with TypeScript always emitting Windows-style new lines
* Add tests

## v0.1.0

* Initial version
