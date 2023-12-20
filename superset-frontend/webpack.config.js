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
const CopyPlugin = require('copy-webpack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const CssMinimizerPlugin = require('css-minimizer-webpack-plugin');
const SpeedMeasurePlugin = require('speed-measure-webpack-plugin');
const createMdxCompiler = require('@storybook/addon-docs/mdx-compiler-plugin');
const {
  WebpackManifestPlugin,
  getCompilerHooks,
} = require('webpack-manifest-plugin');
const ForkTsCheckerWebpackPlugin = require('fork-ts-checker-webpack-plugin');
const parsedArgs = require('yargs').argv;
const getProxyConfig = require('./webpack.proxy-config');
const packageConfig = require('./package');

// input dir
const APP_DIR = path.resolve(__dirname, './');
// output dir
const BUILD_DIR = path.resolve(__dirname, '../superset/static/assets');
const ROOT_DIR = path.resolve(__dirname, '..');

const {
  mode = 'development',
  devserverPort = 9000,
  measure = false,
  analyzeBundle = false,
  analyzerPort = 8888,
  nameChunks = false,
} = parsedArgs;
const isDevMode = mode !== 'production';
const isDevServer = process.argv[1].includes('webpack-dev-server');
const ASSET_BASE_URL = process.env.ASSET_BASE_URL || '';

const output = {
  path: BUILD_DIR,
  publicPath: `${ASSET_BASE_URL}/static/assets/`,
};
if (isDevMode) {
  output.filename = '[name].[contenthash:8].entry.js';
  output.chunkFilename = '[name].[contenthash:8].chunk.js';
} else if (nameChunks) {
  output.filename = '[name].[chunkhash].entry.js';
  output.chunkFilename = '[name].[chunkhash].chunk.js';
} else {
  output.filename = '[name].[chunkhash].entry.js';
  output.chunkFilename = '[chunkhash].chunk.js';
}

if (!isDevMode) {
  output.clean = true;
}

const plugins = [
  new webpack.ProvidePlugin({
    process: 'process/browser.js',
  }),

  // creates a manifest.json mapping of name to hashed output used in template files
  new WebpackManifestPlugin({
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
      Object.entries(entrypoints).forEach(([entry, chunks]) => {
        entryFiles[entry] = {
          css: chunks
            .filter(x => x.endsWith('.css'))
            .map(x => `${output.publicPath}${x}`),
          js: chunks
            .filter(x => x.endsWith('.js') && x.match(/(?<!hot-update).js$/))
            .map(x => `${output.publicPath}${x}`),
        };
      });
      return {
        ...seed,
        entrypoints: entryFiles,
      };
    },
    // Also write manifest.json to disk when running `npm run dev`.
    // This is required for Flask to work.
    writeToFileEmit: isDevMode && !isDevServer,
  }),

  // expose mode variable to other modules
  new webpack.DefinePlugin({
    'process.env.WEBPACK_MODE': JSON.stringify(mode),
    'process.env.REDUX_DEFAULT_MIDDLEWARE':
      process.env.REDUX_DEFAULT_MIDDLEWARE,
    'process.env.SCARF_ANALYTICS': process.env.SCARF_ANALYTICS,
  }),

  new CopyPlugin({
    patterns: [
      'package.json',
      { from: 'src/assets/images', to: 'images' },
      { from: 'src/assets/stylesheets', to: 'stylesheets' },
    ],
  }),

  // static pages
  new HtmlWebpackPlugin({
    template: './src/assets/staticPages/404.html',
    inject: true,
    chunks: [],
    filename: '404.html',
  }),
  new HtmlWebpackPlugin({
    template: './src/assets/staticPages/500.html',
    inject: true,
    chunks: [],
    filename: '500.html',
  }),
];

if (!process.env.CI) {
  plugins.push(new webpack.ProgressPlugin());
}

if (!isDevMode) {
  // text loading (webpack 4+)
  plugins.push(
    new MiniCssExtractPlugin({
      filename: '[name].[chunkhash].entry.css',
      chunkFilename: '[name].[chunkhash].chunk.css',
    }),
  );

  plugins.push(
    // runs type checking on a separate process to speed up the build
    new ForkTsCheckerWebpackPlugin({
      eslint: {
        files: './{src,packages,plugins}/**/*.{ts,tsx,js,jsx}',
        memoryLimit: 4096,
        options: {
          ignorePath: './.eslintignore',
        },
      },
    }),
  );
}

const PREAMBLE = [path.join(APP_DIR, '/src/preamble.ts')];
if (isDevMode) {
  // A Superset webpage normally includes two JS bundles in dev, `theme.ts` and
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
    plugins: ['emotion'],
    presets: [
      [
        '@emotion/babel-preset-css-prop',
        {
          autoLabel: 'dev-only',
          labelFormat: '[local]',
        },
      ],
    ],
  },
};

const config = {
  entry: {
    preamble: PREAMBLE,
    theme: path.join(APP_DIR, '/src/theme.ts'),
    menu: addPreamble('src/views/menu.tsx'),
    spa: addPreamble('/src/views/index.tsx'),
    embedded: addPreamble('/src/embedded/index.tsx'),
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
    sideEffects: true,
    splitChunks: {
      chunks: 'all',
      // increase minSize for devMode to 1000kb because of sourcemap
      minSize: isDevMode ? 1000000 : 20000,
      name: nameChunks,
      automaticNameDelimiter: '-',
      minChunks: 2,
      cacheGroups: {
        automaticNamePrefix: 'chunk',
        // basic stable dependencies
        vendors: {
          priority: 50,
          name: 'vendors',
          test: new RegExp(
            `/node_modules/(${[
              'abortcontroller-polyfill',
              'react',
              'react-dom',
              'prop-types',
              'react-prop-types',
              'prop-types-extra',
              'redux',
              'react-redux',
              'react-hot-loader',
              'react-select',
              'react-sortable-hoc',
              'react-table',
              'react-ace',
              '@hot-loader.*',
              'webpack.*',
              '@?babel.*',
              'lodash.*',
              'antd',
              '@ant-design.*',
              '.*bootstrap',
              'moment',
              'jquery',
              'core-js.*',
              '@emotion.*',
              'd3',
              'd3-(array|color|scale|interpolate|format|selection|collection|time|time-format)',
            ].join('|')})/`,
          ),
        },
        // viz thumbnails are used in `addSlice` and `explore` page
        thumbnail: {
          name: 'thumbnail',
          test: /thumbnail(Large)?\.(png|jpg)/i,
          priority: 20,
          enforce: true,
        },
      },
    },
    usedExports: 'global',
    minimizer: [new CssMinimizerPlugin(), '...'],
  },
  resolve: {
    // resolve modules from `/superset_frontend/node_modules` and `/superset_frontend`
    modules: ['node_modules', APP_DIR],
    alias: {
      // TODO: remove aliases once React has been upgraded to v. 17 and
      //  AntD version conflict has been resolved
      antd: path.resolve(path.join(APP_DIR, './node_modules/antd')),
      react: path.resolve(path.join(APP_DIR, './node_modules/react')),
      // TODO: remove Handlebars alias once Handlebars NPM package has been updated to
      // correctly support webpack import (https://github.com/handlebars-lang/handlebars.js/issues/953)
      handlebars: 'handlebars/dist/handlebars.js',
    },
    extensions: ['.ts', '.tsx', '.js', '.jsx', '.yml'],
    fallback: {
      fs: false,
      vm: require.resolve('vm-browserify'),
      path: false,
    },
  },
  context: APP_DIR, // to automatically find tsconfig.json
  module: {
    rules: [
      {
        test: /datatables\.net.*/,
        loader: 'imports-loader',
        options: {
          additionalCode: 'var define = false;',
        },
      },
      {
        test: /\.tsx?$/,
        exclude: [/\.test.tsx?$/],
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
              // be overridden by `tsconfig.json` in node_modules subdirectories.
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
        // include source code for plugins, but exclude node_modules and test files within them
        exclude: [/superset-ui.*\/node_modules\//, /\.test.jsx?$/],
        include: [
          new RegExp(`${APP_DIR}/(src|.storybook|plugins|packages)`),
          ...['./src', './.storybook', './plugins', './packages'].map(p =>
            path.resolve(__dirname, p),
          ), // redundant but required for windows
          /@encodable/,
        ],
        use: [babelLoader],
      },
      // react-hot-loader use "ProxyFacade", which is a wrapper for react Component
      // see https://github.com/gaearon/react-hot-loader/issues/1311
      // TODO: refactor recurseReactClone
      {
        test: /\.js$/,
        include: /node_modules\/react-dom/,
        use: ['react-hot-loader/webpack'],
      },
      {
        test: /\.css$/,
        include: [APP_DIR, /superset-ui.+\/src/],
        use: [
          isDevMode ? 'style-loader' : MiniCssExtractPlugin.loader,
          {
            loader: 'css-loader',
            options: {
              sourceMap: true,
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
              sourceMap: true,
            },
          },
          {
            loader: 'less-loader',
            options: {
              sourceMap: true,
              lessOptions: {
                javascriptEnabled: true,
                modifyVars: {
                  'root-entry-name': 'default',
                },
              },
            },
          },
        ],
      },
      /* for css linking images (and viz plugin thumbnails) */
      {
        test: /\.png$/,
        issuer: {
          not: [/\/src\/assets\/staticPages\//],
        },
        type: 'asset',
        generator: {
          filename: '[name].[contenthash:8].[ext]',
        },
      },
      {
        test: /\.png$/,
        issuer: /\/src\/assets\/staticPages\//,
        type: 'asset',
      },
      {
        test: /\.svg(\?v=\d+\.\d+\.\d+)?$/,
        issuer: /\.([jt])sx?$/,
        use: [
          {
            loader: '@svgr/webpack',
            options: {
              titleProp: true,
              ref: true,
              // this is the default value for the icon. Using other values
              // here will replace width and height in svg with 1em
              icon: false,
            },
          },
        ],
      },
      {
        test: /\.(jpg|gif)$/,
        type: 'asset/resource',
        generator: {
          filename: '[name].[contenthash:8].[ext]',
        },
      },
      /* for font-awesome */
      {
        test: /\.(woff|woff2|eot|ttf|otf)$/i,
        type: 'asset/resource',
      },
      {
        test: /\.ya?ml$/,
        include: ROOT_DIR,
        loader: 'js-yaml-loader',
      },
      {
        test: /\.geojson$/,
        type: 'asset/resource',
      },
      {
        test: /\.mdx$/,
        use: [
          {
            loader: 'babel-loader',
            // may or may not need this line depending on your app's setup
            options: {
              plugins: ['@babel/plugin-transform-react-jsx'],
            },
          },
          {
            loader: '@mdx-js/loader',
            options: {
              compilers: [createMdxCompiler({})],
            },
          },
        ],
      },
    ],
  },
  externals: {
    cheerio: 'window',
    'react/lib/ExecutionEnvironment': true,
    'react/lib/ReactContext': true,
  },
  plugins,
  devtool: 'source-map',
};

// find all the symlinked plugins and use their source code for imports
Object.entries(packageConfig.dependencies).forEach(([pkg, relativeDir]) => {
  const srcPath = path.join(APP_DIR, `./node_modules/${pkg}/src`);
  const dir = relativeDir.replace('file:', '');

  if (/^@superset-ui/.test(pkg) && fs.existsSync(srcPath)) {
    console.log(`[Superset Plugin] Use symlink source for ${pkg} @ ${dir}`);
    config.resolve.alias[pkg] = path.resolve(APP_DIR, `${dir}/src`);
  }
});
console.log(''); // pure cosmetic new line

let proxyConfig = getProxyConfig();

if (isDevMode) {
  config.devtool = 'eval-cheap-module-source-map';
  config.devServer = {
    onBeforeSetupMiddleware(devServer) {
      // load proxy config when manifest updates
      const { afterEmit } = getCompilerHooks(devServer.compiler);
      afterEmit.tap('ManifestPlugin', manifest => {
        proxyConfig = getProxyConfig(manifest);
      });
    },
    historyApiFallback: true,
    hot: true,
    port: devserverPort,
    // Only serves bundled files from webpack-dev-server
    // and proxy everything else to Superset backend
    proxy: [
      // functions are called for every request
      () => proxyConfig,
    ],
    client: {
      overlay: {
        errors: true,
        warnings: false,
        runtimeErrors: error => !/ResizeObserver/.test(error.message),
      },
      logging: 'error',
    },
    static: path.join(process.cwd(), '../static/assets'),
  };
}

// Bundle analyzer is disabled by default
// Pass flag --analyzeBundle=true to enable
// e.g. npm run build -- --analyzeBundle=true
if (analyzeBundle) {
  config.plugins.push(new BundleAnalyzerPlugin({ analyzerPort }));
}

// Speed measurement is disabled by default
// Pass flag --measure=true to enable
// e.g. npm run build -- --measure=true
const smp = new SpeedMeasurePlugin({
  disable: !measure,
});

module.exports = smp.wrap(config);
