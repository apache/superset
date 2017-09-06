const webpack = require('webpack');
const path = require('path');
const ManifestPlugin = require('webpack-manifest-plugin');
const CleanWebpackPlugin = require('clean-webpack-plugin');
const ExtractTextPlugin = require('extract-text-webpack-plugin');

// input dir
const APP_DIR = path.resolve(__dirname, './');

// output dir
const BUILD_DIR = path.resolve(__dirname, './dist');

const config = {
  node: {
    fs: 'empty',
  },
  entry: {
    theme: APP_DIR + '/javascripts/theme.js',
    common: APP_DIR + '/javascripts/common.js',
    addSlice: ['babel-polyfill', APP_DIR + '/javascripts/addSlice/index.jsx'],
    explore: ['babel-polyfill', APP_DIR + '/javascripts/explore/index.jsx'],
    dashboard: ['babel-polyfill', APP_DIR + '/javascripts/dashboard/Dashboard.jsx'],
    sqllab: ['babel-polyfill', APP_DIR + '/javascripts/SqlLab/index.jsx'],
    welcome: ['babel-polyfill', APP_DIR + '/javascripts/welcome.js'],
    profile: ['babel-polyfill', APP_DIR + '/javascripts/profile/index.jsx'],
  },
  output: {
    path: BUILD_DIR,
    filename: '[name].[chunkhash].entry.js',
    chunkFilename: '[name].[chunkhash].entry.js',
  },
  resolve: {
    extensions: [
      '.js',
      '.jsx',
    ],
    alias: {
      webworkify: 'webworkify-webpack',
      'mapbox-gl$': path.join(__dirname, '/node_modules/mapbox-gl/dist/mapbox-gl.js'),
    },

  },
  module: {
    noParse: /mapbox-gl\/dist/,
    loaders: [
      {
        test: /datatables\.net.*/,
        loader: 'imports-loader?define=>false',
      },
      {
        test: /\.jsx?$/,
        exclude: APP_DIR + '/node_modules',
        loader: 'babel-loader',
        query: {
          presets: [
            'airbnb',
            'es2015',
            'react',
          ],
        },
      },
      /* for mapbox-gl/js/geo/transform */
      {
        test: /\.js$/,
        include: APP_DIR + '/node_modules/mapbox-gl/js',
        loader: 'babel-loader',
      },
      // Extract css files
      {
        test: /\.css$/,
        include: APP_DIR,
        loader: ExtractTextPlugin.extract({
          use: ['css-loader'],
          fallback: 'style-loader',
        }),
      },
      // Optionally extract less files
      // or any other compile-to-css language
      {
        test: /\.less$/,
        include: APP_DIR,
        loader: ExtractTextPlugin.extract({
          use: ['css-loader', 'less-loader'],
          fallback: 'style-loader',
        }),
      },
      /* for css linking images */
      {
        test: /\.png$/,
        loader: 'url-loader?limit=100000',
      },
      {
        test: /\.jpg$/,
        loader: 'file-loader',
      },
      {
        test: /\.gif$/,
        loader: 'file-loader',
      },
      /* for font-awesome */
      {
        test: /\.woff(2)?(\?v=[0-9]\.[0-9]\.[0-9])?$/,
        loader: 'url-loader?limit=10000&mimetype=application/font-woff',
      },
      {
        test: /\.(ttf|eot|svg)(\?v=[0-9]\.[0-9]\.[0-9])?$/,
        loader: 'file-loader',
      },
      /* for mapbox */
      {
        test: /\.json$/,
        loader: 'json-loader',
      },
      {
        test: /\.js$/,
        include: APP_DIR + '/node_modules/mapbox-gl/js/render/painter/use_program.js',
        loader: 'transform/cacheable?brfs',
      },
    ],
  },
  externals: {
    cheerio: 'window',
    'react/lib/ExecutionEnvironment': true,
    'react/lib/ReactContext': true,
  },
  plugins: [
    new ManifestPlugin(),
    new CleanWebpackPlugin(['dist']),
    new webpack.DefinePlugin({
      'process.env': {
        NODE_ENV: JSON.stringify(process.env.NODE_ENV),
      },
    }),
    new ExtractTextPlugin('[name].[chunkhash].css'),
  ],
};
if (process.env.NODE_ENV === 'production') {
  // Using settings suggested in https://github.com/webpack/webpack/issues/537
  const UJSplugin = new webpack.optimize.UglifyJsPlugin({
    sourceMap: false,
    minimize: true,
    parallel: {
      cache: true,
      workers: 4,
    },
    compress: false,
  });
  config.plugins.push(UJSplugin);
}
module.exports = config;
