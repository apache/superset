/* eslint-disable no-console */
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
const fs = require('fs');
const path = require('path');
const webpack = require('webpack');
const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');
const CopyPlugin = require('copy-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const OptimizeCSSAssetsPlugin = require('optimize-css-assets-webpack-plugin');
const SpeedMeasurePlugin = require('speed-measure-webpack-plugin');
const TerserPlugin = require('terser-webpack-plugin');
const ManifestPlugin = require('webpack-manifest-plugin');
const ForkTsCheckerWebpackPlugin = require('fork-ts-checker-webpack-plugin');
const parsedArgs = require('yargs').argv;
const getProxyConfig = require('./webpack.proxy-config');
const packageConfig = require('./package.json');

// input dir
const APP_DIR = path.resolve(__dirname, './');
// output dir
const BUILD_DIR = path.resolve(__dirname, '../superset/static/assets');

const {
  mode = 'development',
  devserverPort = 9000,
  measure = false,
  analyzeBundle = false,
} = parsedArgs;
const isDevMode = mode !== 'production';

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

const plugins = [
  // creates a manifest.json mapping of name to hashed output used in template files
  new ManifestPlugin({
    publicPath: output.publicPath,
    seed: { app: 'superset' },
    // This enables us to include all relevant files for an entry
    generate: (seed, files, entrypoints) => {
      // Each entrypoint's chunk files in the format of
      // {
      //   entry: {
      //     css: [],
      //     js: []
      //   }
      // }
      const entryFiles = {};
      for (const [entry, chunks] of Object.entries(entrypoints)) {
        entryFiles[entry] = {
          css: chunks
            .filter(x => x.endsWith('.css'))
            .map(x => path.join(output.publicPath, x)),
          js: chunks
            .filter(x => x.endsWith('.js'))
            .map(x => path.join(output.publicPath, x)),
        };
      }
      return {
        ...seed,
        entrypoints: entryFiles,
      };
    },
    // Also write to disk when using devServer
    // instead of only keeping manifest.json in memory
    // This is required to make devServer work with flask.
    writeToFileEmit: isDevMode,
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
    eslint: true,
    checkSyntacticErrors: true,
  }),

  new CopyPlugin(
    [
      'package.json',
      { from: 'images', to: 'images' },
      { from: 'stylesheets', to: 'stylesheets' },
    ],
    { copyUnmodified: true },
  ),
];
if (!isDevMode) {
  // text loading (webpack 4+)
  plugins.push(
    new MiniCssExtractPlugin({
      filename: '[name].[chunkhash].entry.css',
      chunkFilename: '[name].[chunkhash].chunk.css',
    }),
  );
  plugins.push(new OptimizeCSSAssetsPlugin());
}

const PREAMBLE = [path.join(APP_DIR, '/src/preamble.js')];
if (isDevMode) {
  // A Superset webpage normally includes two JS bundles in dev, `theme.js` and
  // the main entrypoint. Only the main entry should have the dev server client,
  // otherwise the websocket client will initialize twice, creating two sockets.
  // Ref: https://github.com/gaearon/react-hot-loader/issues/141
  PREAMBLE.unshift(
    `webpack-dev-server/client?http://localhost:${devserverPort}`,
  );
}

function addPreamble(entry) {
  return PREAMBLE.concat([path.join(APP_DIR, entry)]);
}

const babelLoader = {
  loader: 'babel-loader',
  options: {
    cacheDirectory: true,
    // disable gzip compression for cache files
    // faster when there are millions of small files
    cacheCompression: false,
  },
};

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
  stats: 'minimal',
  performance: {
    assetFilter(assetFilename) {
      // don't throw size limit warning on geojson and font files
      return !/\.(map|geojson|woff2)$/.test(assetFilename);
    },
  },
  optimization: {
    splitChunks: {
      chunks: 'all',
      automaticNameDelimiter: '-',
      minChunks: 2,
      cacheGroups: {
        default: false,
        major: {
          name: 'vendors-major',
          test: /\/node_modules\/(brace|react|react-dom|@superset-ui\/translation|webpack.*|@babel.*)\//,
        },
      },
    },
  },
  resolve: {
    alias: {
      src: path.resolve(APP_DIR, './src'),
      'react-dom': '@hot-loader/react-dom',
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
          'thread-loader',
          babelLoader,
          {
            loader: 'ts-loader',
            options: {
              // transpile only in happyPack mode
              // type checking is done via fork-ts-checker-webpack-plugin
              happyPackMode: true,
              transpileOnly: true,
              // must override compiler options here, even though we have set
              // the same options in `tsconfig.json`, because they may still
              // be overriden by `tsconfig.json` in node_modules subdirectories.
              compilerOptions: {
                esModuleInterop: false,
                importHelpers: false,
                module: 'esnext',
                target: 'esnext',
              },
            },
          },
        ],
      },
      {
        test: /\.jsx?$/,
        // include source code for plugins, but exclude node_modules within them
        exclude: [/superset-ui.*\/node_modules\//],
        include: [new RegExp(`${APP_DIR}/src`), /superset-ui.*\/src/],
        use: [babelLoader],
      },
      {
        test: /\.css$/,
        include: [APP_DIR, /superset-ui.+\/src/],
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
  devtool: false,
};

let proxyConfig = getProxyConfig();

if (isDevMode) {
  config.devtool = 'eval-cheap-module-source-map';
  config.devServer = {
    before(app, server, compiler) {
      // load proxy config when manifest updates
      const hook = compiler.hooks.webpackManifestPluginAfterEmit;
      hook.tap('ManifestPlugin', manifest => {
        proxyConfig = getProxyConfig(manifest);
      });
    },
    historyApiFallback: true,
    hot: true,
    injectClient: false,
    injectHot: true,
    inline: true,
    stats: 'minimal',
    overlay: true,
    port: devserverPort,
    // Only serves bundled files from webpack-dev-server
    // and proxy everything else to Superset backend
    proxy: [
      // functions are called for every request
      () => {
        return proxyConfig;
      },
    ],
    contentBase: path.join(process.cwd(), '../static/assets'),
  };

  // find all the symlinked plugins and use their source code for imports
  let hasSymlink = false;
  for (const [pkg, version] of Object.entries(packageConfig.dependencies)) {
    const srcPath = `./node_modules/${pkg}/src`;
    if (/superset-ui/.test(pkg) && fs.existsSync(srcPath)) {
      console.log(
        `[Superset Plugin] Use symlink source for ${pkg} @ ${version}`,
      );
      // only allow exact match so imports like `@superset-ui/plugin-name/lib`
      // and `@superset-ui/plugin-name/esm` can still work.
      config.resolve.alias[`${pkg}$`] = `${pkg}/src`;
      hasSymlink = true;
    }
  }
  if (hasSymlink) {
    console.log(''); // pure cosmetic new line
  }
} else {
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
