# Clean for WebPack
A webpack plugin to remove/clean your build folder(s) before building

![MIT License](https://camo.githubusercontent.com/d59450139b6d354f15a2252a47b457bb2cc43828/68747470733a2f2f696d672e736869656c64732e696f2f6e706d2f6c2f7365727665726c6573732e737667)
[![Build Status][travis-image]][travis-url]
[![Coveralls Status][coveralls-image]][coveralls-url]

## Installation
```
npm i clean-webpack-plugin --save-dev
```

## Usage
```js
const CleanWebpackPlugin = require('clean-webpack-plugin')

// webpack config
{
  plugins: [
    new CleanWebpackPlugin(paths [, {options}])
  ]
}
```

## Example Webpack Config
This is a modified version of [WebPack's Plugin documentation](https://webpack.js.org/concepts/plugins/) that includes the Clean Plugin.

```js
const CleanWebpackPlugin = require('clean-webpack-plugin'); //installed via npm
const HtmlWebpackPlugin = require('html-webpack-plugin'); //installed via npm
const webpack = require('webpack'); //to access built-in plugins
const path = require('path');

// the path(s) that should be cleaned
let pathsToClean = [
  'dist',
  'build'
]

// the clean options to use
let cleanOptions = {
  root:     '/full/webpack/root/path',
  exclude:  ['shared.js'],
  verbose:  true,
  dry:      false
}

// sample WebPack config
const webpackConfig = {
  entry: './path/to/my/entry/file.js',
  output: {
    filename: 'my-first-webpack.bundle.js',
    path: path.resolve(__dirname, 'dist')
  },
  module: {
    rules: [
      {
        test: /\.(js|jsx)$/,
        loader: 'babel-loader'
      }
    ]
  },
  plugins: [
    new CleanWebpackPlugin(pathsToClean, cleanOptions),
    new webpack.optimize.UglifyJsPlugin(),
    new HtmlWebpackPlugin({template: './src/index.html'})
  ]
}

```


### Paths (Required)
An [array] of string paths to clean
```js
[
  'dist',         // removes 'dist' folder
  'build/*.*',    // removes all files in 'build' folder
  'web/*.js'      // removes all JavaScript files in 'web' folder
]
```


### Options and defaults (Optional)
```js
{
  // Absolute path to your webpack root folder (paths appended to this)
  // Default: root of your package
  root: __dirname,

  // Write logs to console.
  verbose: true,
  
  // Use boolean "true" to test/emulate delete. (will not remove files).
  // Default: false - remove files
  dry: false,           

  // If true, remove files on recompile. 
  // Default: false
  watch: false,

  // Instead of removing whole path recursively,
  // remove all path's content with exclusion of provided immediate children.
  // Good for not removing shared files from build directories.
  exclude: [ 'files', 'to', 'ignore' ],

  // allow the plugin to clean folders outside of the webpack root.
  // Default: false - don't allow clean folder outside of the webpack root
  allowExternal: false
  
  // perform clean just before files are emitted to the output dir
  // Default: false
  beforeEmit: false
}
```

[travis-url]: https://travis-ci.org/johnagan/clean-webpack-plugin
[travis-image]: https://travis-ci.org/johnagan/clean-webpack-plugin.svg

[coveralls-url]: https://coveralls.io/github/johnagan/clean-webpack-plugin
[coveralls-image]: https://coveralls.io/repos/johnagan/clean-webpack-plugin/badge.svg
