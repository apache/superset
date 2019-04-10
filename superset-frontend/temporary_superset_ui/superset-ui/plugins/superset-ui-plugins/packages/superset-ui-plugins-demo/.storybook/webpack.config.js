const path = require('path');

const BABEL_TYPESCRIPT_OPTIONS = {
  presets: [
    ['@babel/preset-env', { useBuiltIns: 'entry' }],
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
    exclude: /node_modules/,
    test: /\.tsx?$/,
    use: [{
      loader: 'babel-loader',
      options: BABEL_TYPESCRIPT_OPTIONS,
    }],
  });

  return config;
};
