const path = require('path');

// Export a function. Accept the base config as the only param.
module.exports = (storybookBaseConfig, configType, defaultConfig) => {
  // configType has a value of 'DEVELOPMENT' or 'PRODUCTION'
  // You can change the configuration based on that.
  // 'PRODUCTION' is used when building the static version of storybook.

  defaultConfig.module.rules[0].use[0].options.plugins.push('@babel/plugin-syntax-dynamic-import');

  defaultConfig.module.rules.push({
    exclude: /node_modules/,
    include: new RegExp(`${path.resolve(__dirname, '../../superset-ui-(plugin|preset)-')}.+/src`),
    test: /\.jsx?$/,
    use: defaultConfig.module.rules[0].use,
  });

  // Return the altered config
  return defaultConfig;
};
