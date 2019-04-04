// This is a Webpack 2 configuration file
const {resolve} = require('path');
// const webpack = require('webpack');

module.exports = {
  devServer: {
    stats: {
      warnings: false
    },
    quiet: true
  },

  // Bundle the tests for running in the browser
  entry: {
    'test-fp64': resolve('fp64-shader.spec.js')
  },

  // Generate a bundle in dist folder
  output: {
    path: resolve('./dist'),
    filename: '[name]-bundle.js'
  },

  devtool: '#inline-source-maps',

  resolve: {
    alias: {
      'luma.gl': resolve('../../../../../src')
    }
  },

  module: {
    rules: [
      {
        test: /\.glsl$/,
        use: 'raw-loader'
      }
    ]
  },

  node: {
    fs: 'empty'
  },

  plugins: []
};
