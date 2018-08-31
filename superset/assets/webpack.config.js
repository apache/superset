const path = require('path');
const CleanWebpackPlugin = require('clean-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const webpack = require('webpack');
const WebpackAssetsManifest = require('webpack-assets-manifest');

// input dir
const APP_DIR = path.resolve(__dirname, './');

// output dir
const BUILD_DIR = path.resolve(__dirname, './dist');

const isDevMode = process.env.NODE_ENV !== 'production';

const plugins = [
  // creates a manifest.json mapping of name to hashed output used in template files
  new WebpackAssetsManifest({
    publicPath: true,
    entrypoints: true, // this enables us to include all relevant files for an entry
  }),

  // create fresh dist/ upon build
  new CleanWebpackPlugin(['dist']),
];

if (isDevMode) {
  plugins.push(new webpack.HotModuleReplacementPlugin());
  // text loading (webpack 4+)
  plugins.push(new MiniCssExtractPlugin({
    filename: '[name].[hash].entry.css',
    chunkFilename: '[name].[hash].chunk.css',
  }));
} else {
  // text loading (webpack 4+)
  plugins.push(new MiniCssExtractPlugin({
    filename: '[name].[chunkhash].entry.css',
    chunkFilename: '[name].[chunkhash].chunk.css',
  }));
}

const output = {
  path: BUILD_DIR,
  publicPath: '/static/assets/dist/', // necessary for lazy-loaded chunks
};

if (isDevMode) {
  output.filename = '[name].[hash].entry.js';
  output.chunkFilename = '[name].[hash].chunk.js';
} else {
  output.filename = '[name].[chunkhash].entry.js';
  output.chunkFilename = '[name].[chunkhash].chunk.js';
}

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
  output,
  optimization: {
    splitChunks: {
      chunks: 'all',
      automaticNameDelimiter: '-',
    },
  },
  resolve: {
    extensions: ['.js', '.jsx'],
  },
  module: {
    // uglyfying mapbox-gl results in undefined errors, see
    // https://github.com/mapbox/mapbox-gl-js/issues/4359#issuecomment-288001933
    noParse: /(mapbox-gl)\.js$/,
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
        use: [isDevMode ? MiniCssExtractPlugin.loader : 'style-loader', 'css-loader'],
      },
      {
        test: /\.less$/,
        include: APP_DIR,
        use: [
          isDevMode ? MiniCssExtractPlugin.loader : 'style-loader',
          'css-loader',
          'less-loader',
        ],
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
  plugins,
  devServer: {
    historyApiFallback: true,
    hot: true,
    index: '', // needed to enable root proxying
    inline: true,
    stats: { colors: true },
    open: true,
    port: 8099,
    proxy: {
      context: () => true,
      '/': 'http://localhost:8088',
      target: 'http://localhost:8088',
    },
    contentBase: path.join(process.cwd(), 'static/assets/dist'),
    // publicPath: '/dist/',
  },
};

module.exports = config;
