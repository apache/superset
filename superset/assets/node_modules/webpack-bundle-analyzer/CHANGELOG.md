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
