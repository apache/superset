const path = require('path');

const jsBabelPresets = [
  ['@babel/preset-env', {
    useBuiltIns: 'usage',
    corejs: 3,
    loose: true,
    modules: false,
    shippedProposals: true,
    targets: false
  }],
  '@babel/preset-react',
];

const tsBabelPresets = jsBabelPresets.concat(['@babel/preset-typescript']);

const babelPlugins = [
  '@babel/plugin-proposal-object-rest-spread',
  '@babel/plugin-proposal-class-properties',
  '@babel/plugin-syntax-dynamic-import',
  ["@babel/plugin-transform-runtime", { "corejs": 3 }]
];

module.exports = async ({ config }) => {
  const cacheDirectory = path.resolve('../../../node_modules/.cache/storybook');

  // rule that applies to jsx? files
  config.module.rules[0].use = {
    loader: 'babel-loader',
    options: {
      cacheDirectory,
      presets: jsBabelPresets,
      plugins: babelPlugins,
    }
  };

  // add rule for handling typescript
  config.module.rules.push({
    test: /\.tsx?$/,
    exclude: /node_modules/,
    use: {
      loader: 'babel-loader',
      options: {
        cacheDirectory,
        presets: tsBabelPresets,
        plugins: babelPlugins,
      }
    },
  });

  config.resolve.extensions.push('.ts', '.tsx');

  return config;
};
