const path = require('path');
const { lstatSync, readdirSync } = require('fs');

// find @superset-ui packages
const basePath = path.resolve(__dirname, '../../../node_modules/@superset-ui');
const packages = readdirSync(basePath).filter(name => {
  const stat = lstatSync(path.join(basePath, name));
  return stat.isSymbolicLink();
});

module.exports = {
  addons: [
    '@storybook/preset-typescript',
    '@storybook/addon-actions/register',
    '@storybook/addon-knobs/register',
    'storybook-addon-jsx/register',
    '@storybook/addon-links/register',
  ],
  stories: [
    '../storybook/stories/**/*Stories.[tj]sx',
  ],
  webpackFinal: config => {
    config.module.rules.push({
      test: /\.tsx?$/,
      use: [
        {
          loader: require.resolve('ts-loader'),
        },
      ],
    });

    config.resolve.extensions.push('.ts', '.tsx');
    // let webpack know where to find the source code
    Object.assign(config.resolve.alias, {
      ...packages.reduce(
        (acc, name) => ({
          ...acc,
          [`@superset-ui/${name}$`]: path.join(basePath, name, 'src'),
        }),
        {},
      ),
    });

    config.stats = 'errors-warnings';

    return config;
  },
};
