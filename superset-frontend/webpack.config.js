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

const { ModuleFederationPlugin } = webpack.container;
const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer');
const CopyPlugin = require('copy-webpack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const CssMinimizerPlugin = require('css-minimizer-webpack-plugin');
const TerserPlugin = require('terser-webpack-plugin');
const LightningCSS = require('lightningcss');
const SpeedMeasurePlugin = require('speed-measure-webpack-plugin');
const {
  WebpackManifestPlugin,
  getCompilerHooks,
} = require('webpack-manifest-plugin');
const ForkTsCheckerWebpackPlugin = require('fork-ts-checker-webpack-plugin');
const ReactRefreshWebpackPlugin = require('@pmmmwh/react-refresh-webpack-plugin');
const parsedArgs = require('yargs').argv;
const Visualizer = require('webpack-visualizer-plugin2');
const getProxyConfig = require('./webpack.proxy-config');
const packageConfig = require('./package.json');

// input dir
const APP_DIR = path.resolve(__dirname, './');
// output dir
const BUILD_DIR = path.resolve(__dirname, '../superset/static/assets');
const ROOT_DIR = path.resolve(__dirname, '..');
// Public path for extracted css src:urls. All assets are compiled into the same
// folder. This forces the src:url in the extracted css to only contain the filename
// and will therefore be relative to the .css file itself and not have to worry about
// any url prefix.
const MINI_CSS_EXTRACT_PUBLICPATH = './';

const {
  mode = 'development',
  devserverPort: cliPort,
  devserverHost: cliHost,
  measure = false,
  nameChunks = false,
} = parsedArgs;

// Precedence: CLI args > env vars > defaults
const devserverPort = cliPort || process.env.WEBPACK_DEVSERVER_PORT || 9000;
const devserverHost =
  cliHost || process.env.WEBPACK_DEVSERVER_HOST || '127.0.0.1';

const isDevMode = mode !== 'production';
const isDevServer = process.argv[1]?.includes('webpack-dev-server') ?? false;

// TypeScript checker memory limit (in MB)
const TYPESCRIPT_MEMORY_LIMIT = 8192;

const defaultEntryFilename = isDevMode
  ? '[name].[contenthash:8].entry.js'
  : nameChunks
    ? '[name].[chunkhash].entry.js'
    : '[name].[chunkhash].entry.js';

const defaultChunkFilename = isDevMode
  ? '[name].[contenthash:8].chunk.js'
  : nameChunks
    ? '[name].[chunkhash].chunk.js'
    : '[chunkhash].chunk.js';

const output = {
  path: BUILD_DIR,
  publicPath: '/static/assets/',
  filename: pathData =>
    pathData.chunk?.name === 'service-worker'
      ? '../service-worker.js'
      : defaultEntryFilename,
  chunkFilename: pathData =>
    pathData.chunk?.name === 'service-worker'
      ? '../service-worker.js'
      : defaultChunkFilename,
};

if (!isDevMode) {
  output.clean = true;
}

const plugins = [
  new webpack.ProvidePlugin({
    process: 'process/browser.js',
    ...(isDevMode ? { Buffer: ['buffer', 'Buffer'] } : {}), // Fix legacy-plugin-chart-paired-t-test broken Story
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
    'process.env.SCARF_ANALYTICS': JSON.stringify(process.env.SCARF_ANALYTICS),
  }),

  new CopyPlugin({
    patterns: [
      'package.json',
      { from: 'src/assets/images', to: 'images' },
      { from: 'src/pwa-manifest.json', to: 'pwa-manifest.json' },
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
  new ModuleFederationPlugin({
    name: 'superset',
    filename: 'remoteEntry.js',
    shared: {
      react: {
        singleton: true,
        eager: true,
        requiredVersion: packageConfig.dependencies.react,
      },
      'react-dom': {
        singleton: true,
        eager: true,
        requiredVersion: packageConfig.dependencies['react-dom'],
      },
      antd: {
        singleton: true,
        requiredVersion: packageConfig.dependencies.antd,
        eager: true,
      },
    },
  }),
];

if (!process.env.CI) {
  plugins.push(new webpack.ProgressPlugin());
}

// Add React Refresh plugin for development mode
if (isDevMode) {
  plugins.push(
    new ReactRefreshWebpackPlugin({
      // Exclude service worker from React Refresh - it runs in a worker context
      // without DOM/window and doesn't need HMR
      exclude: /service-worker/,
    }),
  );
}

if (!isDevMode) {
  // CSS extraction for production builds
  plugins.push(
    new MiniCssExtractPlugin({
      filename: '[name].[chunkhash].entry.css',
      chunkFilename: '[name].[chunkhash].chunk.css',
    }),
  );
}

// TypeScript type checking and .d.ts generation
// SWC handles transpilation; this plugin handles type checking separately.
// build: true enables project references so .d.ts files are auto-generated.
// mode: 'write-references' writes .d.ts output (no manual `npm run plugins:build` needed).
// Story files are excluded because they import @storybook-shared which resolves
// outside plugin rootDir ("src"), causing errors in --build mode.
if (isDevMode) {
  plugins.push(
    new ForkTsCheckerWebpackPlugin({
      async: true,
      typescript: {
        build: true,
        mode: 'write-references',
        memoryLimit: TYPESCRIPT_MEMORY_LIMIT,
        configOverwrite: {
          compilerOptions: {
            skipLibCheck: true,
            incremental: true,
          },
          exclude: [
            'src/**/*.js',
            'src/**/*.jsx',
            '**/*.test.*',
            '**/*.stories.*',
          ],
        },
      },
    }),
  );
}

// In dev mode, include theme.ts in preamble to avoid separate chunk HMR issues
const PREAMBLE = isDevMode
  ? [path.join(APP_DIR, 'src/theme.ts'), path.join(APP_DIR, 'src/preamble.ts')]
  : [path.join(APP_DIR, 'src/preamble.ts')];

function addPreamble(entry) {
  return PREAMBLE.concat([path.join(APP_DIR, entry)]);
}

// SWC configuration for TypeScript/JavaScript transpilation
function createSwcLoader(syntax = 'typescript', tsx = true) {
  return {
    loader: 'swc-loader',
    options: {
      jsc: {
        parser: {
          syntax,
          tsx: syntax === 'typescript' ? tsx : undefined,
          jsx: syntax === 'ecmascript',
          decorators: false,
          dynamicImport: true,
        },
        transform: {
          react: {
            runtime: 'automatic',
            importSource: '@emotion/react',
            development: isDevMode,
            refresh: isDevMode,
          },
        },
        target: 'es2015',
        loose: true,
        externalHelpers: false,
        experimental: {
          plugins: [
            [
              '@swc/plugin-emotion',
              {
                sourceMap: isDevMode,
                autoLabel: isDevMode ? 'dev-only' : 'never',
                labelFormat: '[local]',
              },
            ],
            [
              '@swc/plugin-transform-imports',
              {
                lodash: {
                  transform: 'lodash/{{member}}',
                  preventFullImport: true,
                  skipDefaultConversion: false,
                },
                'lodash-es': {
                  transform: 'lodash-es/{{member}}',
                  preventFullImport: true,
                  skipDefaultConversion: false,
                },
              },
            ],
          ],
        },
      },
      module: {
        type: 'es6',
      },
    },
  };
}

const config = {
  entry: {
    preamble: PREAMBLE,
    // In dev mode, theme is included in preamble to avoid separate chunk HMR issues
    ...(isDevMode ? {} : { theme: path.join(APP_DIR, 'src/theme.ts') }),
    menu: addPreamble('src/views/menu.tsx'),
    spa: addPreamble('src/views/index.tsx'),
    embedded: addPreamble('src/embedded/index.tsx'),
    // Skip service-worker build in dev mode to avoid overwriting the placeholder
    ...(isDevMode
      ? {}
      : {
          'service-worker': path.join(APP_DIR, 'src/service-worker.ts'),
        }),
  },
  cache: {
    type: 'filesystem',
    cacheDirectory: path.resolve(__dirname, '.temp_cache'),
    // Separate cache for dev vs prod builds
    name: `${isDevMode ? 'development' : 'production'}-cache`,
    // Invalidate cache when these files change
    buildDependencies: {
      config: [
        __filename,
        path.resolve(__dirname, 'package-lock.json'),
        path.resolve(__dirname, 'babel.config.js'),
        path.resolve(__dirname, 'tsconfig.json'),
      ],
    },
    // Compress cache for smaller disk usage (slight CPU tradeoff)
    compression: isDevMode ? false : 'gzip',
  },
  output,
  stats: 'minimal',
  /*
   Silence warning for missing export in @data-ui's internal structure. This
   issue arises from an internal implementation detail of @data-ui. As it's
   non-critical, we suppress it to prevent unnecessary clutter in the build
   output. For more context, refer to:
   https://github.com/williaster/data-ui/issues/208#issuecomment-946966712
   */
  ignoreWarnings: [
    {
      message:
        /export 'withTooltipPropTypes' \(imported as 'vxTooltipPropTypes'\) was not found/,
    },
    {
      message: /Can't resolve.*superset_text/,
    },
  ],
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
              'react',
              'react-dom',
              'redux',
              'react-redux',
              'react-sortable-hoc',
              'react-table',
              'react-ace',
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
    minimizer: [
      new CssMinimizerPlugin({
        minify: CssMinimizerPlugin.lightningCssMinify,
        minimizerOptions: {
          targets: LightningCSS.browserslistToTargets([
            'last 3 chrome versions',
            'last 3 firefox versions',
            'last 3 safari versions',
            'last 3 edge versions',
          ]),
        },
      }),
      new TerserPlugin({
        minify: TerserPlugin.swcMinify,
        terserOptions: {
          compress: {
            drop_console: false,
          },
          mangle: true,
          format: {
            comments: false,
          },
        },
      }),
    ],
  },
  resolve: {
    // resolve modules from `/superset_frontend/node_modules` and `/superset_frontend`
    modules: [
      'node_modules',
      APP_DIR,
      path.resolve(APP_DIR, 'packages'),
      path.resolve(APP_DIR, 'plugins'),
    ],
    alias: {
      '@storybook-shared': path.resolve(APP_DIR, '.storybook/shared'),
      react: path.resolve(path.join(APP_DIR, './node_modules/react')),
      // TODO: remove Handlebars alias once Handlebars NPM package has been updated to
      // correctly support webpack import (https://github.com/handlebars-lang/handlebars.js/issues/953)
      handlebars: 'handlebars/dist/handlebars.js',
      /*
      Temporary workaround to prevent Webpack from resolving moment locale
      files, which are unnecessary for this project and causing build warnings.
      This prevents "Module not found" errors for moment locale files.
      */
      'moment/min/moment-with-locales': false,
    },
    extensions: ['.ts', '.tsx', '.js', '.jsx', '.yml'],
    fallback: {
      fs: false,
      vm: require.resolve('vm-browserify'),
      path: false,
      stream: require.resolve('stream-browserify'),
      ...(isDevMode ? { buffer: require.resolve('buffer/') } : {}), // Fix legacy-plugin-chart-paired-t-test broken Story
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
        test: /node_modules\/(@deck\.gl|@luma\.gl).*\.js$/,
        loader: 'imports-loader',
        options: {
          additionalCode: 'var module = module || {exports: {}};',
        },
      },
      {
        test: /node_modules\/(geostyler-style|geostyler-qgis-parser)\/.*\.js$/,
        resolve: {
          fullySpecified: false,
        },
      },
      {
        test: /\.tsx?$/,
        exclude: [/\.test.tsx?$/, /node_modules/],
        // Skip thread-loader in dev mode - it breaks HMR by running in worker threads
        use: isDevMode
          ? [createSwcLoader('typescript', true)]
          : ['thread-loader', createSwcLoader('typescript', true)],
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
        use: [createSwcLoader('ecmascript')],
      },
      {
        test: /ace-builds.*\/worker-.*$/,
        type: 'asset/resource',
      },
      {
        test: /\.css$/,
        include: [APP_DIR, /superset-ui.+\/src/],
        use: [
          isDevMode
            ? 'style-loader'
            : {
                loader: MiniCssExtractPlugin.loader,
                options: {
                  publicPath: MINI_CSS_EXTRACT_PUBLICPATH,
                },
              },
          {
            loader: 'css-loader',
            options: {
              sourceMap: true,
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
          filename: '[name].[contenthash:8][ext]',
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
          filename: '[name].[contenthash:8][ext]',
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
      // {
      //   test: /\.mdx?$/,
      //   use: [
      //     {
      //       loader: require.resolve('@storybook/mdx2-csf/loader'),
      //       options: {
      //         skipCsf: false,
      //         mdxCompileOptions: {
      //           remarkPlugins: [remarkGfm],
      //         },
      //       },
      //     },
      //   ],
      // },
    ],
  },
  externals: {
    cheerio: 'window',
    'react/lib/ExecutionEnvironment': true,
    'react/lib/ReactContext': true,
  },
  plugins,
  devtool: isDevMode ? 'eval-cheap-module-source-map' : false,
  watchOptions: isDevMode
    ? {
        // Watch all plugin and package source directories
        ignored: ['**/node_modules', '**/.git', '**/lib', '**/esm', '**/dist'],
        // Poll less frequently to reduce file handles
        poll: 2000,
        // Aggregate changes for 500ms before rebuilding
        aggregateTimeout: 500,
      }
    : undefined,
};

// find all the symlinked plugins and use their source code for imports
Object.entries(packageConfig.dependencies).forEach(([pkg, relativeDir]) => {
  const srcPath = path.join(APP_DIR, `./node_modules/${pkg}/src`);
  const dir = relativeDir.replace('file:', '');

  if (
    (pkg.startsWith('@superset-ui') || pkg.startsWith('@apache-superset')) &&
    fs.existsSync(srcPath)
  ) {
    console.log(`[Superset Plugin] Use symlink source for ${pkg} @ ${dir}`);
    config.resolve.alias[pkg] = path.resolve(APP_DIR, `${dir}/src`);
  }
});
console.log(''); // pure cosmetic new line

if (isDevMode) {
  let proxyConfig = getProxyConfig();
  // Set up a plugin to handle manifest updates
  config.plugins = config.plugins || [];
  config.plugins.push({
    apply: compiler => {
      const { afterEmit } = getCompilerHooks(compiler);
      afterEmit.tap('ManifestPlugin', manifest => {
        proxyConfig = getProxyConfig(manifest);
      });
    },
  });

  config.devServer = {
    devMiddleware: {
      publicPath: '/static/assets/',
      writeToDisk: true,
    },
    historyApiFallback: true,
    hot: 'only', // HMR only, no page reload fallback
    liveReload: false,
    host: devserverHost,
    port: devserverPort,
    allowedHosts: [
      ...new Set([
        devserverHost,
        'localhost',
        '.localhost',
        '127.0.0.1',
        '::1',
        '.local',
      ]),
    ],
    proxy: [() => proxyConfig],
    client: {
      overlay: {
        errors: true,
        warnings: false,
        runtimeErrors: error => !/ResizeObserver/.test(error.message),
      },
      logging: 'info', // Show HMR messages
      webSocketURL: {
        hostname: '0.0.0.0',
        pathname: '/ws',
        port: 0,
      },
    },
    static: {
      directory: path.join(process.cwd(), '../static/assets'),
    },
  };
}

// To
// e.g. npm run package-stats
if (process.env.BUNDLE_ANALYZER) {
  config.plugins.push(new BundleAnalyzerPlugin({ analyzerMode: 'static' }));
  config.plugins.push(
    // this creates an HTML page with a sunburst diagram of dependencies.
    // you'll find it at superset/static/stats/statistics.html
    // note that the file is >100MB so it's in .gitignore
    new Visualizer({
      filename: path.join('..', 'stats', 'statistics.html'),
      throwOnError: true,
    }),
  );
}

// Speed measurement is disabled by default
// Pass flag --measure=true to enable
// e.g. npm run build -- --measure=true
const smp = new SpeedMeasurePlugin({
  disable: !measure,
});

module.exports = smp.wrap(config);
