const path = require('path');
const webpack = require('webpack');
const CleanWebpackPlugin = require('clean-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const OptimizeCSSAssetsPlugin = require('optimize-css-assets-webpack-plugin');
const WebpackAssetsManifest = require('webpack-assets-manifest');

// Parse command-line arguments
const parsedArgs = require('minimist')(process.argv.slice(2));

// input dir
const APP_DIR = path.resolve(__dirname, './');
// output dir
const BUILD_DIR = path.resolve(__dirname, './dist');

const {
  mode = 'development',
  devserverPort = 9000,
  supersetPort = 8088,
} = parsedArgs;

const isDevMode = mode !== 'production';

const plugins = [
  // creates a manifest.json mapping of name to hashed output used in template files
  new WebpackAssetsManifest({
    publicPath: true,
    // This enables us to include all relevant files for an entry
    entrypoints: true,
    // Also write to disk when using devServer
    // instead of only keeping manifest.json in memory
    // This is required to make devServer work with flask.
    writeToDisk: isDevMode,
  }),

  // create fresh dist/ upon build
  new CleanWebpackPlugin(['dist']),
];

if (isDevMode) {
  // Enable hot module replacement
  plugins.push(new webpack.HotModuleReplacementPlugin());
} else {
  // text loading (webpack 4+)
  plugins.push(new MiniCssExtractPlugin({
    filename: '[name].[chunkhash].entry.css',
    chunkFilename: '[name].[chunkhash].chunk.css',
  }));
  plugins.push(new OptimizeCSSAssetsPlugin());
}

const output = {
  path: BUILD_DIR,
  publicPath: '/static/assets/dist/', // necessary for lazy-loaded chunks
};

if (isDevMode) {
  output.filename = '[name].[hash:8].entry.js';
  output.chunkFilename = '[name].[hash:8].chunk.js';
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
        use: [
          isDevMode ? 'style-loader' : MiniCssExtractPlugin.loader,
          'css-loader',
        ],
      },
      {
        test: /\.less$/,
        include: APP_DIR,
        use: [
          isDevMode ? 'style-loader' : MiniCssExtractPlugin.loader,
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
  devtool: isDevMode ? 'cheap-module-eval-source-map' : false,
  devServer: {
    historyApiFallback: true,
    hot: true,
    index: '', // This line is needed to enable root proxying
    inline: true,
    stats: { colors: true },
    overlay: true,
    port: devserverPort,
    // Only serves bundled files from webpack-dev-server
    // and proxy everything else to Superset backend
    proxy: {
      context: () => true,
      '/': `http://localhost:${supersetPort}`,
      target: `http://localhost:${supersetPort}`,
    },
    contentBase: path.join(process.cwd(), '../static/assets/dist'),
  },
};

module.exports = config;
