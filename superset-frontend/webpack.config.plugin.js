const fs = require('fs');
const path = require('path');
const webpack = require('webpack');
const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const SpeedMeasurePlugin = require('speed-measure-webpack-plugin');
const { WebpackManifestPlugin } = require('webpack-manifest-plugin');
const ForkTsCheckerWebpackPlugin = require('fork-ts-checker-webpack-plugin');
const parsedArgs = require('yargs').argv;
const Dotenv = require('dotenv');
const rm = require('rimraf');
const packageConfig = require('./package');
const BASE_VERSION = require('./src/version/base');
const CHANGE_VERSION = require('./src/version/change');

const {
  PROD_OUTPUT_FOLDER,
  DEV_OUTPUT_FOLDER,
  getHtmlTemplate,
} = require('./src/webpackUtils/constants');

const {
  mode = 'development',
  devserverPort = 3000,
  measure = false,
  analyzeBundle = false,
  analyzerPort = 8888,
  env = '.env',
} = parsedArgs;

const envFile = env || '.env';

const isDev = mode !== 'production';
const isProd = mode === 'production';

const getPublicPath = (isProdMode, path) =>
  isProdMode ? (path ? `${path}/` : '') : '';

// input dir
const ROOT_DIR = path.resolve(__dirname, './');
// output dir
const BUILD_DIR = path.resolve(
  __dirname,
  isProd ? PROD_OUTPUT_FOLDER : DEV_OUTPUT_FOLDER,
);

/*
 ** APP VERSION BASE is a base from which the app inherited the code base
 ** (i.e. 1.3 => was inherited from Superset 1.3)
 */
const APP_VERSION = `${BASE_VERSION}_${CHANGE_VERSION}`;

console.group('Params:');
console.log('Parsed Args', parsedArgs);
console.log('______');
console.log('isProd =>', JSON.stringify(isProd));
console.log('input ROOT_DIR =>', JSON.stringify(ROOT_DIR));
console.log('webpack mode =>', JSON.stringify(mode));
console.log('output BUILD_DIR =>', JSON.stringify(BUILD_DIR));
console.log('APP_VERSION =>', JSON.stringify(APP_VERSION));
console.log('______');
console.log('');
console.groupEnd();

console.group('Config:');
const envFileParsed = `./${envFile}`;
console.log('envFile =>', envFile);
console.log('envFileParsed =>', envFileParsed);

const envConfig = Dotenv.config({ path: envFileParsed }).parsed;
console.log('envConfig =>', envConfig);

const envKeys = Object.keys(envConfig).reduce((prev, next) => {
  // eslint-disable-next-line no-param-reassign
  prev[`process.env.${next}`] = JSON.stringify(envConfig[next]);
  return prev;
}, {});

const FULL_ENV = {
  ...envKeys,
  'process.env.WEBPACK_MODE': JSON.stringify(mode),
  'process.env.APP_VERSION': JSON.stringify(APP_VERSION),
};
const publicPath = FULL_ENV['process.env.publicPath'].split('"').join('');

console.log('FULL_ENV =>', FULL_ENV);
console.log('publicPath =>', publicPath);
console.log('getPublicPath =>', getPublicPath(isProd, publicPath));
console.log('');
console.groupEnd();

// process.exit();

// clearing the directory
rm(BUILD_DIR, err => {
  if (err) throw err;
});

const output = {
  path: BUILD_DIR,
  // publicPath: `${ASSET_BASE_URL}/static/assets/`,
  publicPath: getPublicPath(isProd, publicPath),
  filename: '[name].[hash].js',
  library: '[name]',
  libraryTarget: 'this',
};

if (!isDev) {
  output.clean = true;
}

const plugins = [
  new webpack.DefinePlugin(FULL_ENV),

  new WebpackManifestPlugin({
    removeKeyHash: /([a-f0-9]{1,32}\.?)/gi,
  }),

  // expose mode variable to other modules
  new webpack.DefinePlugin({
    'process.env.WEBPACK_MODE': JSON.stringify(mode),
  }),

  new HtmlWebpackPlugin({
    title: 'Superset dashboard plugin',
    minify: false,
    filename: 'index.html',
    meta: {
      charset: 'UTF-8',
      viewport: 'width=device-width, initial-scale=1, shrink-to-fit=no',
    },
    templateContent: ({ htmlWebpackPlugin }) =>
      getHtmlTemplate(htmlWebpackPlugin),
  }),
  new MiniCssExtractPlugin({
    filename: '[name].[hash].css',
    linkType: 'text/css',
  }),
  // new OptimizeCSSAssetsPlugin(),
];

if (!process.env.CI) {
  plugins.push(new webpack.ProgressPlugin());
}

if (!isDev) {
  //   // text loading (webpack 4+)
  //   plugins.push(
  //     new MiniCssExtractPlugin({
  //       filename: '[name].[chunkhash].entry.css',
  //       chunkFilename: '[name].[chunkhash].chunk.css',
  //     }),
  //   );

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

const PREAMBLE = [path.join(ROOT_DIR, '/src/preamble.ts')];

function addPreamble(entry) {
  return PREAMBLE.concat([path.join(ROOT_DIR, entry)]);
}
const config = {
  entry: {
    supersetDashboardPlugin: addPreamble('/src/Superstructure/main.tsx'),
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
    usedExports: 'global',
    splitChunks: {
      cacheGroups: {
        styles: {
          name: 'supersetDashboardPlugin',
          type: 'css/mini-extract',
          chunks: 'all',
          enforce: true,
        },
      },
    },
  },
  resolve: {
    // resolve modules from `/superset_frontend/node_modules` and `/superset_frontend`
    modules: ['node_modules', ROOT_DIR],
    alias: {
      // TODO: remove aliases once React has been upgraded to v. 17 and
      //  AntD version conflict has been resolved
      antd: path.resolve(path.join(ROOT_DIR, './node_modules/antd')),
      react: path.resolve(path.join(ROOT_DIR, './node_modules/react')),
    },
    extensions: ['.ts', '.tsx', '.js', '.jsx', '.yml'],
    fallback: {
      fs: false,
      vm: require.resolve('vm-browserify'),
      path: false,
    },
  },
  context: ROOT_DIR, // to automatically find tsconfig.json
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
        // include source code for plugins, but exclude node_modules and test files within them
        exclude: [/superset-ui.*\/node_modules\//, /\.test.jsx?$/],
        include: [
          new RegExp(`${ROOT_DIR}/(src|.storybook|plugins|packages)`),
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
        include: [ROOT_DIR, /superset-ui.+\/src/],
        use: [
          // {
          //   loader: 'style-loader',
          //   options: {
          //     injectType: 'singletonStyleTag',
          //     insert: 'body',
          //   },
          // },
          MiniCssExtractPlugin.loader,
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
        include: ROOT_DIR,
        use: [
          // MiniCssExtractPlugin.loader,
          {
            loader: 'style-loader',
            options: {
              injectType: 'singletonStyleTag',
              insert: 'head',
            },
          },
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
          filename: '[name].[contenthash:8][ext]',
        },
      },
      {
        test: /\.png$/,
        issuer: /\/src\/assets\/staticPages\//,
        type: 'asset',
        generator: {
          filename: '[name].[contenthash:8].[ext]',
        },
        // generator: {
        //   publicPath: STATIC_FILES_DIR,
        // }
      },
      {
        test: /\.svg(\?v=\d+\.\d+\.\d+)?$/,
        issuer: /\.([jt])sx?$/,
        use: [
          {
            loader: '@svgr/webpack',
            options: {
              svgoConfig: {
                plugins: {
                  removeViewBox: false,
                  icon: true,
                },
              },
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
        generator: {
          filename: '[name].[contenthash:8].[ext]',
        },
      },
      {
        test: /\.ya?ml$/,
        include: ROOT_DIR,
        loader: 'js-yaml-loader',
      },
      {
        test: /\.geojson$/,
        type: 'asset/resource',
        generator: {
          filename: '[name].[contenthash:8].[ext]',
        },
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
  const srcPath = path.join(ROOT_DIR, `./node_modules/${pkg}/src`);
  const dir = relativeDir.replace('file:', '');

  if (/^@superset-ui/.test(pkg) && fs.existsSync(srcPath)) {
    console.log(`[Superset Plugin] Use symlink source for ${pkg} @ ${dir}`);
    config.resolve.alias[pkg] = path.resolve(ROOT_DIR, `${dir}/src`);
  }
});
console.log(''); // pure cosmetic new line

if (isDev) {
  config.devtool = 'eval-cheap-module-source-map';
  config.devServer = {
    historyApiFallback: true,
    hot: true,
    port: devserverPort,
    devMiddleware: {
      index: true,
      publicPath: path.join(process.cwd(), DEV_OUTPUT_FOLDER),
      serverSideRender: true,
      writeToDisk: true,
    },
    client: {
      progress: true,
      overlay: {
        errors: true,
        warnings: false,
      },
      logging: 'error',
    },
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
