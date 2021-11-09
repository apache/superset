const path = require('path');
const ForkTsCheckerWebpackPlugin = require('fork-ts-checker-webpack-plugin');
const { lstatSync, readdirSync } = require('fs');

// find @superset-ui packages
const basePath = path.resolve(__dirname, '../../../node_modules/@superset-ui');
const packages = readdirSync(basePath).filter(name => {
  const stat = lstatSync(path.join(basePath, name));
  return stat.isSymbolicLink();
});

const rootPath = path.resolve(__dirname, '../../../');

const PLUGIN_PACKAGES_PATH_REGEXP = new RegExp(
  `${path.resolve(
    __dirname,
    '../../../plugins/(legacy-)*(plugin|preset)-',
  )}.+/src`,
);

module.exports = {
  addons: [
    '@storybook/addon-knobs',
    'storybook-addon-jsx',
    '@storybook/addon-actions',
    '@storybook/addon-links',
  ],
  stories: ['../storybook/stories/**/*Stories.[tj]sx'],
  webpackFinal: config => {
    // Make sure babel is applied to the package src
    // These are excluded by the default rule
    // because they reside in node_modules
    config.module.rules.push({
      include: PLUGIN_PACKAGES_PATH_REGEXP,
      exclude: /node_modules/,
      test: /\.jsx?$/,
      use: config.module.rules[0].use,
    });

    config.module.rules.push({
      test: /\.tsx?$/,
      use: [
        {
          loader: require.resolve('ts-loader'),
          options: {
            transpileOnly: true,
          },
        },
      ],
    });

    config.plugins.unshift(new ForkTsCheckerWebpackPlugin());

    config.resolve.extensions.push('.ts', '.tsx');

    // Let webpack know where to find the source code
    Object.assign(config.resolve.alias, {
      ...packages.reduce(
        (acc, name) => ({
          ...acc,
          [`@superset-ui/${name}$`]: path.join(basePath, name, 'src'),
        }),
        {},
      ),
    });

    // todo: remove hard code after move storybook to superset repo.
    config.resolve.alias['@emotion/styled'] = path.resolve(
      rootPath,
      './node_modules/@emotion/styled',
    );
    config.resolve.alias['@emotion/core'] = path.resolve(
      rootPath,
      './node_modules/@emotion/core',
    );

    config.devtool = 'eval-cheap-module-source-map';
    config.devServer = {
      ...config.devServer,
      stats: 'minimal',
    };

    return config;
  },
};
