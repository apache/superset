const path = require('path');

// your app's webpack.config.js
const customConfig = require('../webpack.config.js');

module.exports = {
  stories: ['../src/components/**/*.stories.jsx'],
  addons: [
    '@storybook/addon-actions',
    '@storybook/addon-links',
    '@storybook/preset-typescript',
    'storybook-addon-jsx',
  ],
  webpackFinal: config => {
    return {
      ...config,
      // module: { ...config.module, rules: custom.module.rules },
      module: {
        ...config.module,
        rules: customConfig.module.rules,
      },
      plugins: [...config.plugins, ...customConfig.plugins],
    };
    // return {
    //   ...config,
    //   ...customConfig,
    // };
  },
};


// const customConfig = require('../../../../../webpack.config');

// module.exports = async ({ config, mode }) => {
//   return {
//     ...config,
//     module: {
//       rules: customConfig.module.rules,
//     },
//     plugins: [...config.plugins, ...customConfig.plugins],
//   };
// };