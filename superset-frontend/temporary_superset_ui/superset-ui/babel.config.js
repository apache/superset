const { getConfig } = require('@airbnb/config-babel');

const config = getConfig({
  library: true,
  react: true,
  next: true,
  esm: process.env.BABEL_OUTPUT === 'esm',
  node: process.env.NODE_ENV === 'test',
  typescript: true,
  env: {
    targets: false,
  },
});

// Override to allow transpile es modules inside vega-lite
config.ignore = config.ignore.filter(item => item !== 'node_modules/');
config.ignore.push('node_modules/(?!(vega-lite|lodash-es))');
config.plugins = [
  ['babel-plugin-transform-dev', { evaluate: false }],
  ['babel-plugin-typescript-to-proptypes', { loose: true }],
  ['@babel/plugin-proposal-class-properties', { loose: true }],
];
config.presets.push([
  '@emotion/babel-preset-css-prop',
  {
    autoLabel: 'dev-only',
    labelFormat: '[local]',
  },
]);
module.exports = config;
