var webpack = require('webpack');
var path    = require('path');

var APP_DIR   = path.resolve(__dirname, './'); // input
var BUILD_DIR = path.resolve(__dirname, './javascripts/dist'); // output

var config = {
  // for now generate one compiled js file per entry point / html page
  entry: {
    base: APP_DIR + '/javascripts/base.js',
    index: APP_DIR + '/javascripts/index.jsx',
    // dashboard: APP_DIR + '/javascripts/dist/dashboard.js',
    explore: APP_DIR + '/javascripts/explore.js',
  },
  output: {
    path: BUILD_DIR,
    filename: '[name].entry.js'
  },
  module : {
    loaders : [
      {
        test: /\.jsx?/,
        include: APP_DIR,
        exclude: APP_DIR + '/node_modules',
        loader: 'babel' // transpile jsx + ES2015/6 -> ES5
      },
      {
        test: /\.css$/,
        exclude: APP_DIR + '/node_modules',
        loader: "style-loader!css-loader" // load css via require('../*.css')
      }
    ]
  },
  plugins: [
    // @TODO: this will be used in the future to expose these packages through global window vars
    // new webpack.ProvidePlugin({
    //     $: "jquery",
    //     jQuery: "jquery",
    //     d3: "d3",
    //     px: './modules/panoramix.js'
    // })
  ]
};

module.exports = config;
