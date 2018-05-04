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
    theme: APP_DIR + '/src/theme.js',
    common: APP_DIR + '/src/common.js',
    addSlice: ['babel-polyfill', APP_DIR + '/src/addSlice/index.jsx'],
    explore: ['babel-polyfill', APP_DIR + '/src/explore/index.jsx'],
    dashboard: ['babel-polyfill', APP_DIR + '/src/dashboard/index.jsx'],
    sqllab: ['babel-polyfill', APP_DIR + '/src/SqlLab/index.jsx'],
    welcome: ['babel-polyfill', APP_DIR + '/src/welcome/index.jsx'],
    profile: ['babel-polyfill', APP_DIR + '/src/profile/index.jsx'],
  },
  output: {
    path: BUILD_DIR,
    publicPath: '/static/assets/dist/', // necessary for lazy-loaded chunks
    filename: '[name].[chunkhash].entry.js',
    chunkFilename: '[name].[chunkhash].chunk.js',
  },
  resolve: {
    extensions: [
      '.js',
      '.jsx',
    ],
  },
  module: {
    rules: [
      {
        test: /datatables\.net.*/,
        loader: 'imports-loader?define=>false',
      },
      {
        test: /\.jsx?$/,
        exclude: /node_modules/,
        loader: 'babel-loader',
      },
      {
        test: /\.css$/,
        include: APP_DIR,
        loader: ExtractTextPlugin.extract({
          use: ['css-loader'],
          fallback: 'style-loader',
          // this is needed due to a webpack bug for importing CSS in lazy loaded JS files
          // see https://github.com/webpack-contrib/extract-text-webpack-plugin/issues/456
          allChunks: true,
        }),
      },
      {
        test: /\.less$/,
        include: APP_DIR,
        loader: ExtractTextPlugin.extract({
          use: ['css-loader', 'less-loader'],
          fallback: 'style-loader',
          // this is needed due to a webpack bug for importing CSS in lazy loaded JS files
          // see https://github.com/webpack-contrib/extract-text-webpack-plugin/issues/456
          allChunks: true,
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
    ],
  },
  externals: {
    cheerio: 'window',
    'react/lib/ExecutionEnvironment': true,
    'react/lib/ReactContext': true,
  },
  plugins: [
    new ManifestPlugin(), // this is used to look up hashed filenames in html templates
    new CleanWebpackPlugin(['dist']),
    new ExtractTextPlugin('[name].[chunkhash].css'),
  ],
};

module.exports = config;
