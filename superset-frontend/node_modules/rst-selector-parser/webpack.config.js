/* eslint-disable */

const path = require('path');
const webpack = require('webpack');

module.exports = {
  entry: path.resolve(__dirname, 'src/browser'),
  output: {
    path: path.resolve(__dirname, 'demo'),
    filename: 'scalpel.js'
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        include: path.resolve(__dirname, 'src'),
        use: [
          {
            loader: 'babel-loader'
          }
        ]
      }
    ]
  }
};
