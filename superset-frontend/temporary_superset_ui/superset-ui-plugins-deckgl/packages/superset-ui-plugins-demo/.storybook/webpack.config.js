const path = require('path');
const TerserPlugin = require('terser-webpack-plugin');
const webpack = require('webpack');

const BABEL_TYPESCRIPT_OPTIONS = {
  presets: [
    ['@babel/preset-env', { useBuiltIns: 'entry', corejs: 3 }],
    '@babel/preset-react',
    '@babel/preset-typescript',
  ],
  plugins: [
    '@babel/plugin-proposal-object-rest-spread',
    '@babel/plugin-proposal-class-properties',
    '@babel/plugin-syntax-dynamic-import',
  ]
};

const SIBLING_PACKAGES_PATH_REGEXP = new RegExp(
  `${path.resolve(__dirname, '../../superset-ui-(legacy-)*(plugin|preset)-')}.+/src`,
);

module.exports = async ({ config }) => {
  config.resolve = config.resolve || {};
  config.resolve.extensions = ['.tsx', '.ts', '.jsx', '.js'];

  config.plugins.push(new webpack.IgnorePlugin(/^\.\/locale$/, /moment$/));
  // Avoid parsing large libraries to speed up build
  config.module.noParse = /jquery|moment/;

  // To enable live debugging of other packages when referring to `src`
  config.module.rules.push({
    include: SIBLING_PACKAGES_PATH_REGEXP,
    exclude: /node_modules/,
    test: /\.jsx?$/,
    use: config.module.rules[0].use,
  });

  // Enable TypeScript
  config.module.rules.push({
    include: SIBLING_PACKAGES_PATH_REGEXP,
    exclude: /node_modules/,
    test: /\.tsx?$/,
    use: [{
      loader: 'babel-loader',
      options: BABEL_TYPESCRIPT_OPTIONS,
    }],
  });

  config.module.rules.push({
    include: path.resolve(__dirname, '../storybook'),
    exclude: /node_modules/,
    test: /\.tsx?$/,
    use: [{
      loader: 'babel-loader',
      options: BABEL_TYPESCRIPT_OPTIONS,
    }],
  });

  config.optimization = config.optimization || {};
  config.optimization.splitChunks = {
    chunks: 'async'
  };
  config.optimization.minimizer = [
    new TerserPlugin({
      parallel: true,
      extractComments: true,
    }),
  ];

  if (process.env.RUNNING_CONTEXT === 'netlify') {
    config.devtool = false;
    config.cache = false;
  }

  return config;
};
