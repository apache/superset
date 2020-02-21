/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
const os = require('os');
const path = require('path');
const webpack = require('webpack');
const BundleAnalyzerPlugin = require('webpack-bundle-analyzer')
  .BundleAnalyzerPlugin;
const { CleanWebpackPlugin } = require('clean-webpack-plugin');
const CopyPlugin = require('copy-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const OptimizeCSSAssetsPlugin = require('optimize-css-assets-webpack-plugin');
const SpeedMeasurePlugin = require('speed-measure-webpack-plugin');
const TerserPlugin = require('terser-webpack-plugin');
const WebpackAssetsManifest = require('webpack-assets-manifest');
const ForkTsCheckerWebpackPlugin = require('fork-ts-checker-webpack-plugin');

// Parse command-line arguments
const parsedArgs = require('minimist')(process.argv.slice(2));

// input dir
const APP_DIR = path.resolve(__dirname, './');
// output dir
const BUILD_DIR = path.resolve(__dirname, '../superset/static/assets');

const {
  mode = 'development',
  devserverPort = 9000,
  supersetPort = 8088,
  measure = false,
  analyzeBundle = false,
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
  new CleanWebpackPlugin({
    dry: false,
    // required because the build directory is outside the frontend directory:
    dangerouslyAllowCleanPatternsOutsideProject: true,
  }),

  // expose mode variable to other modules
  new webpack.DefinePlugin({
    'process.env.WEBPACK_MODE': JSON.stringify(mode),
  }),

  // runs type checking on a separate process to speed up the build
  new ForkTsCheckerWebpackPlugin({
    checkSyntacticErrors: true,
  }),

  new CopyPlugin([
    'package.json',
    { from: 'images', to: 'images' },
    { from: 'stylesheets', to: 'stylesheets' },
  ]),
];

if (isDevMode) {
  // Enable hot module replacement
  plugins.push(new webpack.HotModuleReplacementPlugin());
} else {
  // text loading (webpack 4+)
  plugins.push(
    new MiniCssExtractPlugin({
      filename: '[name].[chunkhash].entry.css',
      chunkFilename: '[name].[chunkhash].chunk.css',
    }),
  );
  plugins.push(new OptimizeCSSAssetsPlugin());
}

const output = {
  path: BUILD_DIR,
  publicPath: '/static/assets/', // necessary for lazy-loaded chunks
};

if (isDevMode) {
  output.filename = '[name].[hash:8].entry.js';
  output.chunkFilename = '[name].[hash:8].chunk.js';
} else {
  output.filename = '[name].[chunkhash].entry.js';
  output.chunkFilename = '[name].[chunkhash].chunk.js';
}

const PREAMBLE = ['babel-polyfill', path.join(APP_DIR, '/src/preamble.js')];

function addPreamble(entry) {
  return PREAMBLE.concat([path.join(APP_DIR, entry)]);
}

const config = {
  node: {
    fs: 'empty',
  },
  entry: {
    theme: path.join(APP_DIR, '/src/theme.js'),
    preamble: PREAMBLE,
    addSlice: addPreamble('/src/addSlice/index.jsx'),
    explore: addPreamble('/src/explore/index.jsx'),
    dashboard: addPreamble('/src/dashboard/index.jsx'),
    sqllab: addPreamble('/src/SqlLab/index.jsx'),
    welcome: addPreamble('/src/welcome/index.jsx'),
    profile: addPreamble('/src/profile/index.jsx'),
    showSavedQuery: [path.join(APP_DIR, '/src/showSavedQuery/index.jsx')],
  },
  output,
  optimization: {
    splitChunks: {
      chunks: 'all',
      automaticNameDelimiter: '-',
      minChunks: 2,
      cacheGroups: {
        default: false,
        major: {
          name: 'vendors-major',
          test: /[\\/]node_modules\/(brace|react[-]dom|@superset[-]ui\/translation)[\\/]/,
        },
      },
    },
  },
  resolve: {
    alias: {
      src: path.resolve(APP_DIR, './src'),
    },
    extensions: ['.ts', '.tsx', '.js', '.jsx'],
    symlinks: false,
  },
  context: APP_DIR, // to automatically find tsconfig.json
  module: {
    // Uglifying mapbox-gl results in undefined errors, see
    // https://github.com/mapbox/mapbox-gl-js/issues/4359#issuecomment-288001933
    noParse: /(mapbox-gl)\.js$/,
    rules: [
      {
        test: /datatables\.net.*/,
        loader: 'imports-loader?define=>false',
      },
      {
        test: /\.tsx?$/,
        use: [
          { loader: 'cache-loader' },
          {
            loader: 'thread-loader',
            options: {
              // there should be 1 cpu for the fork-ts-checker-webpack-plugin
              workers: os.cpus().length - 1,
            },
          },
          {
            loader: 'ts-loader',
            options: {
              // transpile only in happyPack mode
              // type checking is done via fork-ts-checker-webpack-plugin
              happyPackMode: true,
            },
          },
        ],
      },
      {
        test: /\.jsx?$/,
        exclude: /node_modules/,
        include: APP_DIR,
        loader: 'babel-loader',
      },
      {
        // handle symlinked modules
        // for debugging @superset-ui packages via npm link
        test: /\.jsx?$/,
        include: /node_modules\/[@]superset[-]ui.+\/src/,
        use: [
          {
            loader: 'babel-loader',
            options: {
              presets: ['airbnb', '@babel/preset-react', '@babel/preset-env'],
              plugins: [
                'lodash',
                '@babel/plugin-syntax-dynamic-import',
                'react-hot-loader/babel',
              ],
            },
          },
        ],
      },
      {
        test: /\.css$/,
        include: [APP_DIR, /superset[-]ui.+\/src/],
        use: [
          isDevMode ? 'style-loader' : MiniCssExtractPlugin.loader,
          {
            loader: 'css-loader',
            options: {
              sourceMap: isDevMode,
            },
          },
        ],
      },
      {
        test: /\.less$/,
        include: APP_DIR,
        use: [
          isDevMode ? 'style-loader' : MiniCssExtractPlugin.loader,
          {
            loader: 'css-loader',
            options: {
              sourceMap: isDevMode,
            },
          },
          {
            loader: 'less-loader',
            options: {
              sourceMap: isDevMode,
            },
          },
        ],
      },
      /* for css linking images */
      {
        test: /\.png$/,
        loader: 'url-loader',
        options: {
          limit: 10000,
          name: '[name].[hash:8].[ext]',
        },
      },
      {
        test: /\.(jpg|gif)$/,
        loader: 'file-loader',
        options: {
          name: '[name].[hash:8].[ext]',
        },
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
    contentBase: path.join(process.cwd(), '../static/assets'),
  },
};

if (!isDevMode) {
  config.optimization.minimizer = [
    new TerserPlugin({
      cache: '.terser-plugin-cache/',
      parallel: true,
      extractComments: true,
    }),
  ];
}

// Bundle analyzer is disabled by default
// Pass flag --analyzeBundle=true to enable
// e.g. npm run build -- --analyzeBundle=true
if (analyzeBundle) {
  config.plugins.push(new BundleAnalyzerPlugin());
}

// Speed measurement is disabled by default
// Pass flag --measure=true to enable
// e.g. npm run build -- --measure=true
const smp = new SpeedMeasurePlugin({
  disable: !measure,
});

module.exports = smp.wrap(config);
