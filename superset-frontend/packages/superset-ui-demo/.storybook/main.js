import { dirname, join } from "path";
const customConfig = require('../../../webpack.config.js');

module.exports = {
  addons: [
    getAbsolutePath("@storybook/addon-controls"),
    getAbsolutePath("storybook-addon-jsx"),
    getAbsolutePath("@storybook/addon-actions"),
    getAbsolutePath("@storybook/addon-links"),
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

  framework: {
    name: getAbsolutePath("@storybook/react-webpack5"),
    options: {}
  },

  docs: {
    autodocs: true
  }
};

function getAbsolutePath(value) {
  return dirname(require.resolve(join(value, "package.json")));
}
