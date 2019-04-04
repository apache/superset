'use strict'

const path = require('path')
const webpack = require('webpack')

module.exports = {
  entry: ['./docs/index.js'],
  output: {
    path: path.join(__dirname, 'docs/build'),
    filename: 'bundle.js',
    publicPath: '/build/',
  },
  module: {
    loaders: [{
      test: /\.jsx?$/,
      loader: 'babel',
      exclude: /node_modules/,
      query: {
        cacheDirectory: true,
        presets: ['react', 'es2015', 'stage-0'],
      },
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
      'reactcss': path.resolve(__dirname, './lib/index.js'),
    },
    extensions: ['', '.js', '.jsx', '.cjsx'],
    fallback: [path.resolve(__dirname, './modules')],
  },
  plugins: [
    new webpack.DefinePlugin({
      'process.env': {
        NODE_ENV: JSON.stringify('production'),
      },
    }),
    new webpack.optimize.DedupePlugin(),
  ],
  devtool: 'eval',
  quiet: true,
}
