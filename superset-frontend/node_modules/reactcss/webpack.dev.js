'use strict'

const path = require('path')
const webpack = require('webpack')

module.exports = {
  entry: ['webpack-dev-server/client?http://localhost:2570', 'webpack/hot/dev-server', './docs/index.js'],
  output: {
    path: './docs/build',
    filename: 'bundle.js',
    publicPath: 'http://localhost:2570/docs/build/',
  },
  module: {
    loaders: [
      {
        exclude: /node_modules/,
        test: /\.js$/,
        loaders: ['react-hot-loader', 'babel?presets[]=react'],
      }, {
        test: /\.jsx$/,
        exclude: /node_modules/,
        loaders: ['react-hot-loader', 'babel'],
      }, {
        test: /\.css$/,
        loaders: ['style-loader', 'css-loader'],
      }, {
        test: /\.md$/,
        loaders: ['html-loader'],
      },
    ],
  },
  resolve: {
    alias: {
      'reactcss': path.resolve(__dirname, './src/index.js'),
    },
    extensions: ['', '.js', '.jsx', '.cjsx'],
    fallback: [path.resolve(__dirname, './modules')],
  },
  plugins: [
    new webpack.HotModuleReplacementPlugin({ quiet: true }),
    new webpack.NoErrorsPlugin(),
  ],
  devtool: 'eval',
  quiet: true,
}
