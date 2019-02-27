const path = require('path');
const os = require('os');
const ForkTsCheckerWebpackPlugin = require('fork-ts-checker-webpack-plugin');

// Export a function. Accept the base config as the only param.
module.exports = (storybookBaseConfig, configType, defaultConfig) => {
  // configType has a value of 'DEVELOPMENT' or 'PRODUCTION'
  // You can change the configuration based on that.
  // 'PRODUCTION' is used when building the static version of storybook.

  defaultConfig.resolve = defaultConfig.resolve || {};
  defaultConfig.resolve.extensions = ['.ts', '.tsx', '.js', '.jsx'];

  defaultConfig.plugins.push(new ForkTsCheckerWebpackPlugin({
    checkSyntacticErrors: true,
  }));

  defaultConfig.module.rules[0].use[0].options.plugins.push('@babel/plugin-syntax-dynamic-import');

  defaultConfig.module.rules.push({
    exclude: /node_modules/,
    include: new RegExp(`${path.resolve(__dirname, '../../superset-ui-(plugin|preset)-')}.+/src`),
    test: /\.jsx?$/,
    use: defaultConfig.module.rules[0].use,
  });

  defaultConfig.module.rules.push({
    test: /\.tsx?$/,
    use: [
      { loader: 'cache-loader' },
      {
        loader: 'thread-loader',
        options: {
            // there should be 1 cpu for the fork-ts-checker-webpack-plugin
          workers: os.cpus().length - 1,
        },
      },
      {
        loader: 'ts-loader',
        options: {
          // transpile only in happyPack mode
          // type checking is done via fork-ts-checker-webpack-plugin
          happyPackMode: true,
        },
      },
    ],
  });

  // Return the altered config
  return defaultConfig;
};
