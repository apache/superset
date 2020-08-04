const webpack = require('webpack');
const path = require('path');


module.exports = {
  mode: 'development',
  devtool: 'source-map',
  entry: {
    'index': './example/index',
    'split': './example/split',
  },
  output: {
    path: path.join(__dirname, 'example/static'),
    filename: '[name].js',
    publicPath: '/static/',
  },
  plugins: [
    new webpack.optimize.OccurrenceOrderPlugin(),
    new webpack.HotModuleReplacementPlugin(),
  ],
  module: {
    rules: [{
      test: /(\.js|\.jsx)$/,
      use: {
        loader: 'babel-loader'
      },
      exclude: /node_modules/,
    }],
  },
  devServer: {
    hot: true,
    contentBase:  [path.join(__dirname, 'example'), path.join(__dirname, 'dist')],
    compress: true,
    port: 9000,
  },
};
