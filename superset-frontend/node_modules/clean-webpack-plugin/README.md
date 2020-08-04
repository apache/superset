# Clean plugin for webpack

[![npm][npm-image]][npm-url]
[![MIT License][mit-license-image]][mit-license-url]
[![Linux Build Status][circleci-image]][circleci-url]
[![Windows Build Status][appveyor-image]][appveyor-url]
[![Coveralls Status][coveralls-image]][coveralls-url]

[npm-url]: https://www.npmjs.com/package/clean-webpack-plugin
[npm-image]: https://img.shields.io/npm/v/clean-webpack-plugin.svg?label=npm%20version
[mit-license-url]: LICENSE
[mit-license-image]: https://camo.githubusercontent.com/d59450139b6d354f15a2252a47b457bb2cc43828/68747470733a2f2f696d672e736869656c64732e696f2f6e706d2f6c2f7365727665726c6573732e737667
[circleci-url]: https://circleci.com/gh/johnagan/clean-webpack-plugin/tree/master
[circleci-image]: https://img.shields.io/circleci/project/github/johnagan/clean-webpack-plugin/master.svg?label=linux%20build
[appveyor-url]: https://ci.appveyor.com/project/johnagan/clean-webpack-plugin/branch/master
[appveyor-image]: https://img.shields.io/appveyor/ci/johnagan/clean-webpack-plugin/master.svg?label=windows%20build
[coveralls-url]: https://codecov.io/gh/johnagan/clean-webpack-plugin/branch/master
[coveralls-image]: https://img.shields.io/codecov/c/github/johnagan/clean-webpack-plugin/master.svg

A webpack plugin to remove/clean your build folder(s).

> NOTE: Node v8+ and webpack v3+ are supported and tested.

## About

By default, this plugin will remove all files inside webpack's `output.path` directory, as well as all unused webpack assets after every successful rebuild.

> Coming from `v1`? Please read about [additional v2 information](https://github.com/johnagan/clean-webpack-plugin/issues/106).

## Installation

`npm install --save-dev clean-webpack-plugin`

## Usage

```js
const { CleanWebpackPlugin } = require('clean-webpack-plugin');

const webpackConfig = {
    plugins: [
        /**
         * All files inside webpack's output.path directory will be removed once, but the
         * directory itself will not be. If using webpack 4+'s default configuration,
         * everything under <PROJECT_DIR>/dist/ will be removed.
         * Use cleanOnceBeforeBuildPatterns to override this behavior.
         *
         * During rebuilds, all webpack assets that are not used anymore
         * will be removed automatically.
         *
         * See `Options and Defaults` for information
         */
        new CleanWebpackPlugin(),
    ],
};

module.exports = webpackConfig;
```

## Options and Defaults (Optional)

```js
new CleanWebpackPlugin({
    // Simulate the removal of files
    //
    // default: false
    dry: true,

    // Write Logs to Console
    // (Always enabled when dry is true)
    //
    // default: false
    verbose: true,

    // Automatically remove all unused webpack assets on rebuild
    //
    // default: true
    cleanStaleWebpackAssets: false,

    // Do not allow removal of current webpack assets
    //
    // default: true
    protectWebpackAssets: false,

    // **WARNING**
    //
    // Notes for the below options:
    //
    // They are unsafe...so test initially with dry: true.
    //
    // Relative to webpack's output.path directory.
    // If outside of webpack's output.path directory,
    //    use full path. path.join(process.cwd(), 'build/**/*')
    //
    // These options extend del's pattern matching API.
    // See https://github.com/sindresorhus/del#patterns
    //    for pattern matching documentation

    // Removes files once prior to Webpack compilation
    //   Not included in rebuilds (watch mode)
    //
    // Use !negative patterns to exclude files
    //
    // default: ['**/*']
    cleanOnceBeforeBuildPatterns: ['**/*', '!static-files*'],
    cleanOnceBeforeBuildPatterns: [], // disables cleanOnceBeforeBuildPatterns

    // Removes files after every build (including watch mode) that match this pattern.
    // Used for files that are not created directly by Webpack.
    //
    // Use !negative patterns to exclude files
    //
    // default: []
    cleanAfterEveryBuildPatterns: ['static*.*', '!static1.js'],

    // Allow clean patterns outside of process.cwd()
    //
    // requires dry option to be explicitly set
    //
    // default: false
    dangerouslyAllowCleanPatternsOutsideProject: true,
});
```

## Example Webpack Config

This is a modified version of [WebPack's Plugin documentation](https://webpack.js.org/concepts/plugins/) that includes the Clean Plugin.

```js
const { CleanWebpackPlugin } = require('clean-webpack-plugin'); // installed via npm
const HtmlWebpackPlugin = require('html-webpack-plugin'); // installed via npm
const webpack = require('webpack'); // to access built-in plugins
const path = require('path');

module.exports = {
    entry: './path/to/my/entry/file.js',
    output: {
        /**
         * With zero configuration,
         *   clean-webpack-plugin will remove files inside the directory below
         */
        path: path.resolve(process.cwd(), 'dist'),
    },
    module: {
        rules: [
            {
                test: /\.(js|jsx)$/,
                loader: 'babel-loader',
            },
        ],
    },
    plugins: [
        new webpack.ProgressPlugin(),
        new CleanWebpackPlugin(),
        new HtmlWebpackPlugin({ template: './src/index.html' }),
    ],
};
```
