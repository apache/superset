const webpack = require('webpack');
const path = require('path');
const fs = require('fs');

// input dir
const APP_DIR = path.resolve(__dirname, './');

// output dir
const BUILD_DIR = path.resolve(__dirname, './dist');

const VERSION_STRING = JSON.parse(fs.readFileSync('package.json')).version;

const config = {
  entry: {
    'css-theme': APP_DIR + '/javascripts/css-theme.js',
    common: APP_DIR + '/javascripts/common.js',
    dashboard: ['babel-polyfill', APP_DIR + '/javascripts/dashboard/Dashboard.jsx'],
    explore: ['babel-polyfill', APP_DIR + '/javascripts/explore/explore.jsx'],
    explorev2: ['babel-polyfill', APP_DIR + '/javascripts/explorev2/index.jsx'],
    sqllab: ['babel-polyfill', APP_DIR + '/javascripts/SqlLab/index.jsx'],
    standalone: ['babel-polyfill', APP_DIR + '/javascripts/standalone.js'],
    welcome: ['babel-polyfill', APP_DIR + '/javascripts/welcome.js'],
    profile: ['babel-polyfill', APP_DIR + '/javascripts/profile/index.jsx'],
  },
  output: {
    path: BUILD_DIR,
    filename: `[name].${VERSION_STRING}.entry.js`,
  },
  resolve: {
    extensions: [
      '',
      '.js',
      '.jsx',
    ],
    alias: {
      webworkify: 'webworkify-webpack',
      'mapbox-gl/js/geo/transform': path.join(
        __dirname, '/node_modules/mapbox-gl/js/geo/transform'),
      'mapbox-gl': path.join(__dirname, '/node_modules/mapbox-gl/dist/mapbox-gl.js'),
    },

  },
  module: {
    noParse: /mapbox-gl\/dist/,
    loaders: [
      {
        test: /datatables\.net.*/,
        loader: 'imports?define=>false',
      },
      {
        test: /\.jsx?$/,
        exclude: APP_DIR + '/node_modules',
        loader: 'babel',
        query: {
          presets: [
            'airbnb',
            'es2015',
            'react',
          ],
        },
      },
      /* for react-map-gl overlays */
      {
        test: /\.react\.js$/,
        include: APP_DIR + '/node_modules/react-map-gl/src/overlays',
        loader: 'babel',
      },
      /* for require('*.css') */
      {
        test: /\.css$/,
        include: APP_DIR,
        loader: 'style-loader!css-loader',
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
        loader: 'url-loader?limit=10000&minetype=application/font-woff',
      },
      {
        test: /\.(ttf|eot|svg)(\?v=[0-9]\.[0-9]\.[0-9])?$/,
        loader: 'file-loader',
      },
      /* for require('*.less') */
      {
        test: /\.less$/,
        include: APP_DIR,
        loader: 'style!css!less',
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
    postLoaders: [{
      include: /node_modules\/mapbox-gl/,
      loader: 'transform',
      query: 'brfs',
    }],
  },
  externals: {
    cheerio: 'window',
    'react/lib/ExecutionEnvironment': true,
    'react/lib/ReactContext': true,
  },
  plugins: [
    new webpack.DefinePlugin({
      'process.env': {
        NODE_ENV: JSON.stringify(process.env.NODE_ENV),
      },
    }),
  ],
};
if (process.env.NODE_ENV === 'production') {
  config.plugins.push(new webpack.optimize.UglifyJsPlugin());
}
module.exports = config;
