# Changelog

> **Tags:**
> - [Breaking Change]
> - [New Feature]
> - [Improvement]
> - [Bug Fix]
> - [Internal]
> - [Documentation]

_Note: Gaps between patch versions are faulty, broken or test releases._

## UNRELEASED

<!-- Add changelog entries for new changes under this section -->

## 3.6.1

 * **Bug Fix**
   * Add leading zero to hour & minute on `<title />` when needed ([#314](https://github.com/webpack-contrib/webpack-bundle-analyzer/pull/314) by [@mhxbe](https://github.com/mhxbe))
   
 * **Internal**
   * Update some dependencies to get rid of vulnerability warnings ([#339](https://github.com/webpack-contrib/webpack-bundle-analyzer/pull/339))

## 3.6.0

 * **Improvement**
   * Support webpack builds where `output.globalObject` is set to `'self'` ([#323](https://github.com/webpack-contrib/webpack-bundle-analyzer/pull/323) by [@lemonmade](https://github.com/lemonmade))
   * Improve readability of tooltips ([#320](https://github.com/webpack-contrib/webpack-bundle-analyzer/pull/320) by [@lorenzos](https://github.com/lorenzos))

## 3.5.2

 * **Bug Fix**
   * Fix sidebar not showing visibility status of chunks hidden via popup menu (issue [#316](https://github.com/webpack-contrib/webpack-bundle-analyzer/issues/316) by [@gaokun](https://github.com/gaokun), fixed in [#317](https://github.com/webpack-contrib/webpack-bundle-analyzer/pull/317) by [@bregenspan](https://github.com/bregenspan))

## 3.5.1

 * **Bug Fix**
   * Fix regression in support of webpack dev server and `webpack --watch` (issue [#312](https://github.com/webpack-contrib/webpack-bundle-analyzer/issues/312), fixed in [#313](https://github.com/webpack-contrib/webpack-bundle-analyzer/pull/313) by [@gaokun](https://github.com/gaokun))

## 3.5.0

 * **Improvements**
   * Improved report title and added favicon ([#310](https://github.com/webpack-contrib/webpack-bundle-analyzer/pull/310), [@gaokun](https://github.com/gaokun))

## 3.4.1

 * **Bug Fix**
   * Fix regression of requiring an object to be passed to `new BundleAnalyzerPlugin()` (issue [#300](https://github.com/webpack-contrib/webpack-bundle-analyzer/issues/300), fixed in [#302](https://github.com/webpack-contrib/webpack-bundle-analyzer/pull/302) by [@jerryOnlyZRJ](https://github.com/jerryOnlyZRJ))

## 3.4.0

 * **Improvements**
   * Add `port: 'auto'` option ([#290](https://github.com/webpack-contrib/webpack-bundle-analyzer/pull/290), [@avin-kavish](https://github.com/avin-kavish))

 * **Bug Fix**
   * Avoid mutation of the generated `stats.json` ([#293](https://github.com/webpack-contrib/webpack-bundle-analyzer/pull/293), [@wood1986](https://github.com/wood1986))

 * **Internal**
   * Use Autoprefixer ([#266](https://github.com/webpack-contrib/webpack-bundle-analyzer/pull/266), [@bregenspan](https://github.com/bregenspan))
   * Detect `AsyncMFS` to support dev-server of Nuxt 2.5 and above ([#275](https://github.com/webpack-contrib/webpack-bundle-analyzer/pull/275), [@amoshydra](https://github.com/amoshydra))

## 3.3.2

 * **Bug Fix**
   * Fix regression with escaping internal assets ([#264](https://github.com/webpack-contrib/webpack-bundle-analyzer/pull/264), fixes [#263](https://github.com/webpack-contrib/webpack-bundle-analyzer/issues/263))

## 3.3.1

 * **Improvements**
   * Use relative links for serving internal assets ([#261](https://github.com/webpack-contrib/webpack-bundle-analyzer/pull/261), fixes [#254](https://github.com/webpack-contrib/webpack-bundle-analyzer/issues/254))
   * Properly escape embedded JS/JSON ([#262](https://github.com/webpack-contrib/webpack-bundle-analyzer/pull/262))

 * **Bug Fix**
   * Fix showing help message on `-h` flag ([#260](https://github.com/webpack-contrib/webpack-bundle-analyzer/pull/260), fixes [#239](https://github.com/webpack-contrib/webpack-bundle-analyzer/issues/239))

## 3.3.0

 * **New Feature**
   * Show/hide chunks using context menu ([#246](https://github.com/webpack-contrib/webpack-bundle-analyzer/pull/246), [@bregenspan](https://github.com/bregenspan))

 * **Internal**
   * Updated dev dependencies

## 3.2.0

 * **Improvements**
   * Add support for .mjs output files ([#252](https://github.com/webpack-contrib/webpack-bundle-analyzer/pull/252), [@jlopezxs](https://github.com/jlopezxs))

## 3.1.0

 * **Bug Fix**
   * Properly determine the size of the modules containing special characters ([#223](https://github.com/webpack-contrib/webpack-bundle-analyzer/pull/223), [@hulkish](https://github.com/hulkish))
   * Update acorn to v6 ([#248](https://github.com/webpack-contrib/webpack-bundle-analyzer/pull/248), [@realityking](https://github.com/realityking))

## 3.0.4

 * **Bug Fix**
   * Make webpack's done hook wait until analyzer writes report or stat file ([#247](https://github.com/webpack-contrib/webpack-bundle-analyzer/pull/247), [@mareolan](https://github.com/mareolan))

## 3.0.3

 * **Bug Fix**
   * Disable viewer websocket connection when report is generated in `static` mode ([#215](https://github.com/webpack-contrib/webpack-bundle-analyzer/pull/215), [@sebastianhaeni](https://github.com/sebastianhaeni))

## 3.0.2

 * **Improvements**
   * Drop `@babel/runtime` dependency ([#209](https://github.com/webpack-contrib/webpack-bundle-analyzer/pull/209), [@realityking](https://github.com/realityking))
   * Properly specify minimal Node.js version in `.babelrc` ([#209](https://github.com/webpack-contrib/webpack-bundle-analyzer/pull/209), [@realityking](https://github.com/realityking))

 * **Bug Fix**
   * Move some "dependencies" to "devDependencies" ([#209](https://github.com/webpack-contrib/webpack-bundle-analyzer/pull/209), [@realityking](https://github.com/realityking))

## 3.0.1

 * **Bug Fix**
   * Small UI fixes

## 3.0.0

 * **Breaking change**
   * Dropped support for Node.js v4. Minimal required version now is v6.14.4
   * Contents of concatenated modules are now hidden by default because of a number of related issues ([details](https://github.com/webpack-contrib/webpack-bundle-analyzer/issues/188)), but can be shown using a new checkbox in the sidebar.

 * **New Feature**
   * Added modules search
   * Added ability to pin and resize the sidebar
   * Added button to toggle the sidebar
   * Added checkbox to show/hide contents of concatenated modules

 * **Improvements**
   * Nested folders that contain only one child folder are now visually merged i.e. `folder1 => folder2 => file1` is now shown like `folder1/folder2 => file1` (thanks to [@varun-singh-1](https://github.com/varun-singh-1) for the idea)
   
 * **Internal**
   * Dropped support for Node.js v4
   * Using MobX for state management
   * Updated dependencies

## 2.13.1

 * **Improvement**
   * Pretty-format the generated stats.json ([#180](https://github.com/webpack-contrib/webpack-bundle-analyzer/pull/180)) [@edmorley](https://github.com/edmorley))
   
 * **Bug Fix**
   * Properly parse Webpack 4 async chunk with `Array.concat` optimization ([#184](https://github.com/webpack-contrib/webpack-bundle-analyzer/pull/184), fixes [#183](https://github.com/webpack-contrib/webpack-bundle-analyzer/issues/183))
  
 * **Internal**
   * Refactor bundle parsing logic ([#184](https://github.com/webpack-contrib/webpack-bundle-analyzer/pull/184))

## 2.13.0

 * **Improvement**
   * Loosen bundle parsing logic ([#181](https://github.com/webpack-contrib/webpack-bundle-analyzer/pull/181)). Now analyzer will still show parsed sizes even if:
     * It can't parse some bundle chunks. Those chunks just won't have content in the report. Fixes issues like [#160](https://github.com/webpack-contrib/webpack-bundle-analyzer/issues/160).
     * Some bundle chunks are missing (it couldn't find files to parse). Those chunks just won't be visible in the report for parsed/gzipped sizes.

## 2.12.0

 * **New Feature**
   * Add option that allows to exclude assets from the report ([#178](https://github.com/webpack-contrib/webpack-bundle-analyzer/pull/178))

## 2.11.3

 * **Bug Fix**
   * Filter out modules that weren't found during bundles parsing ([#177](https://github.com/webpack-contrib/webpack-bundle-analyzer/pull/177))

## 2.11.2

 * **Bug Fix**
   * Properly process stat files that contain modules inside of `chunks` array ([#175](https://github.com/webpack-contrib/webpack-bundle-analyzer/pull/175))
   * Fix parsing of async chunks that push to `this.webpackJsonp` array ([#176](https://github.com/webpack-contrib/webpack-bundle-analyzer/pull/176))

## 2.11.1

 * **Improvement**
   * Add support for parsing Webpack 4's chunked modules ([#159](https://github.com/webpack-contrib/webpack-bundle-analyzer/pull/159), [@jdelStrother](https://github.com/jdelStrother))

## 2.11.0

 * **Improvement**
   * Show contents of concatenated module (requires Webpack 4) ([#158](https://github.com/webpack-contrib/webpack-bundle-analyzer/pull/158), closes [#157](https://github.com/webpack-contrib/webpack-bundle-analyzer/issues/157))

## 2.10.1

 * **Improvement**
   * Support webpack 4 without deprecation warnings. @ai in [#156](https://github.com/webpack-contrib/webpack-bundle-analyzer/pull/156), fixes [#154](https://github.com/webpack-contrib/webpack-bundle-analyzer/issues/154)

## 2.10.0

 * **Bug Fix**
   * Fix "out of memory" crash when dealing with huge stats objects ([#129](https://github.com/webpack-contrib/webpack-bundle-analyzer/pull/129), [@ryan953](https://github.com/ryan953))

 * **Internal**
   * Update dependencies ([#146](https://github.com/webpack-contrib/webpack-bundle-analyzer/pull/146))
   * Update gulp to v4 and simplify gulpfile ([#146](https://github.com/webpack-contrib/webpack-bundle-analyzer/pull/146), [#149](https://github.com/webpack-contrib/webpack-bundle-analyzer/pull/149))
   * Simplify ESLint configs ([#148](https://github.com/webpack-contrib/webpack-bundle-analyzer/pull/148))

## 2.9.2

 * **Bug Fix**
   * Add a listener for the 'error' event on the WebSocket server client (#140)

 * **Internal**
   * Clean up .travis.yml (#140)
   * Update ws to version 4.0.0 (#140)

## 2.9.1

 * **Bug Fix**
   * Bump `ws` dependency to fix DoS vulnerability (closes [#130](https://github.com/webpack-contrib/webpack-bundle-analyzer/issues/130))

## 2.9.0
 * **New Feature**
   * Show chunk sizes in sidebar (closes #91)

 * **Bug Fix**
   * Properly parse webpack bundles that use arrow functions as module wrappers (#108, @regiontog)

## 2.8.3
 * **Bug Fix**
   * Correctly advertise port when using a random one (#89, @yannickcr)
   * Add proper support for `multi` entries (fixes #92, #87)
   * Support parsing of ESNext features (fixes #94)

## 2.8.2
 * **Improvement**
   * Greatly improved accuracy of gzip sizes

 * **Bug Fix**
   * Generate report file in the bundle output directory when used with Webpack Dev Server (fixes #75)

## 2.8.1
 * **Improvement**
   * Improve warning message when analyzer client couldn't connect to WebSocket server

## 2.8.0
 * **Improvement**
   * Analyzer now supports `webpack --watch` and Webpack Dev Server!
     It will automatically update modules treemap according to changes in the sources via WebSockets!

 * **Internal**
   * Use `babel-preset-env` and two different Babel configs to compile node and browser code
   * Update deps

## 2.7.0
 * **New Feature**
   * Add control to sidebar that allows to choose shown chunks (closes #71 and partially addresses #38)

## 2.6.0
 * **New Feature**
   * Add `defaultSizes` option (closes #52)

## 2.5.0
 * **New Feature**
   * Added `--host` CLI option (@difelice)

## 2.4.1
 * **Improvement**
   * Support `NamedChunksPlugin` (@valscion)

## 2.4.0
 * **Bug Fix**
   * Fix `TypeError: currentFolder.addModule is not a function`

 * **Internal**
   * Update deps

## 2.3.1
 * **Improvement**
   * Improve compatibility with Webpack 2 (@valscion)

## 2.3.0
 * **Improvement**
   * Add `analyzerHost` option (@freaz)

 * **Internal**
   * Update deps

## 2.2.3
 * **Bug Fix**
   * Support bundles that uses `Array.concat` expression in modules definition (@valscion)

## 2.2.1
 * **Bug Fix**
   * Fix regression in analyzing stats files with non-empty `children` property (@gbakernet)

## 2.2.0
 * **Improvement**
   * Improve treemap sharpness on hi-res displays (fixes #33)
   * Add support for stats files with all the information under `children` property (fixes #10)

 * **Internal**
   * Update deps

## 2.1.1
 * **Improvement**
   * Add support for `output.jsonpFunction` webpack config option (fixes #16)

## 2.1.0
 * **New Feature**
   * Add `logLevel` option (closes #19)

## 2.0.1
 * **Bug Fix**
   * Support query in bundle filenames (fixes #22)

 * **Internal**
   * Minimize CSS for report UI

## 2.0.0
 * **New Feature**
   * Analyzer now also shows gzipped sizes (closes #6)
   * Added switcher that allows to choose what sizes will be used to generate tree map.
     Just move your mouse to the left corner of the browser and settings sidebar will appear.

 * **Bug Fix**
   * Properly show sizes for some asset modules (e.g. CSS files loaded with `css-loader`)

 * **Internal**
   * Completely rewritten analyzer UI. Now uses Preact and Webpack 2.

## 1.5.4

 * **Bug Fix**
   * Fix bug when Webpack build is being controlled by some wrapper like `grunt-webpack` (see #21)

## 1.5.3

 * **Bug Fix**
   * Workaround `Express` bug that caused wrong `ejs` version to be used as view engine (fixes #17)

## 1.5.2

 * **Bug Fix**
   * Support array module descriptors that can be generated if `DedupePlugin` is used (fixes #4)

## 1.5.1

 * **Internal**
   * Plug analyzer to Webpack compiler `done` event instead of `emit`. Should fix #15.

## 1.5.0

 * **New Feature**
   * Add `statsOptions` option for `BundleAnalyzerPlugin`

## 1.4.2

 * **Bug Fix**
   * Fix "Unable to find bundle asset" error when bundle name starts with `/` (fixes #3)

## 1.4.1

 * **Bug Fix**
   * Add partial support for `DedupePlugin` (see #4 for more info)

## 1.4.0

 * **New Feature**
   * Add "static report" mode (closes #2)

## 1.3.0

 * **Improvement**
   * Add `startAnalyzer` option for `BundleAnalyzerPlugin` (fixes #1)
 * **Internal**
   * Make module much slimmer - remove/replace bloated dependencies

## 1.2.5

 * Initial public release
