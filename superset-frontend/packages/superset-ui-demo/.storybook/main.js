const customConfig = require('../../../webpack.config.js');

module.exports = {
  core: {
    builder: 'webpack5',
  },
  addons: [
    '@storybook/addon-knobs',
    'storybook-addon-jsx',
    '@storybook/addon-actions',
    '@storybook/addon-links',
  ],
  stories: ['../storybook/stories/**/*Stories.[tj]sx'],
  webpackFinal: config => ({
    ...config,
    module: {
      ...config.module,
      rules: customConfig.module.rules,
    },
    resolve: {
      ...config.resolve,
      ...customConfig.resolve,
    },
  }),
  typescript: {
    reactDocgen: 'none',
  },
};
