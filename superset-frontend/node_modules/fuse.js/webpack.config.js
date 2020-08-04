const webpack = require('webpack')
const path = require('path')
const fs = require('fs')
const package = require('./package.json')

const LIBRARY_NAME = 'fuse'
const VERSION = package.version
const AUTHOR = package.author
const HOMEPAGE = package.homepage

const UglifyJsPlugin = webpack.optimize.UglifyJsPlugin
const env = process.env.WEBPACK_ENV

let copyright = fs.readFileSync('COPYRIGHT.txt', 'UTF8')
let outputFile
let plugins = [
  new webpack.BannerPlugin({
    banner: copyright
      .replace('{VERSION}', `v${VERSION}`)
      .replace('{AUTHOR_URL}', `${AUTHOR.url}`)
      .replace('{HOMEPAGE}', `${HOMEPAGE}`),
    entryOnly: true
  })
]

if (env === 'build') {
  plugins.push(new UglifyJsPlugin({ minimize: true }))
  outputFile = `${LIBRARY_NAME}.min.js`
} else {
  outputFile = `${LIBRARY_NAME}.js`
}

const config = {
  entry: __dirname + './src/index.js',
  devtool: 'source-map',
  entry: './src',
  output: {
    path: __dirname + '/dist',
    filename: outputFile,
    library: 'Fuse',
    libraryTarget: 'umd',
    umdNamedDefine: true
  },
  module: {
    loaders: [{
      test: /(\.js)$/,
      loader: 'babel-loader',
      exclude: /(node_modules)/
    }]
  },
  plugins: plugins
}

module.exports = config