const webpack = require('webpack');
const baseConfig = require('./webpack.config.base');

const config = Object.assign({}, baseConfig);
config.plugins = [
  new webpack.optimize.OccurrenceOrderPlugin(),
  new webpack.DefinePlugin({
    'process.env.NODE_ENV': JSON.stringify('development'),
  }),
];
config.mode = 'development'
module.exports = config;
