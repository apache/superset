'use strict'

const fs = require('fs');
const path = require('path');
const webpack = require('webpack');
const UglifyJsPlugin = require('uglifyjs-webpack-plugin');

const version = require('../package.json').version;
const license = require('./license-template');
const header = `
/*!
@fileoverview gl-matrix - High performance matrix and vector operations
@author Brandon Jones
@author Colin MacKenzie IV
@version ${version}

${license}

*/`;

module.exports = {
  entry: path.join(process.cwd(), 'src/gl-matrix.js'),
  mode: 'production',
  output: {
    path: path.join(process.cwd(), 'dist'),
    filename: 'gl-matrix.js',
    libraryTarget: 'umd',
    globalObject: 'typeof self !== \'undefined\' ? self : this'
  },
  module: {
    rules: [{
      test: path.join(process.cwd(), 'src'),
      exclude: /node_modules/,
      loader: 'babel-loader',
    }]
  },
  plugins: [
    new webpack.BannerPlugin({ banner: header, raw: true }),
  ]
};
