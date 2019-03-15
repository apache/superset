module.exports = (baseConfig, env, config) => {
  const customConfig = config;

  customConfig.module.rules.push({
    loader: require.resolve('babel-loader'),
    options: {
      presets: [
        ['@babel/preset-env', { useBuiltIns: 'entry' }],
        '@babel/preset-react',
        '@babel/preset-typescript',
      ],
    },
    test: /\.tsx?$/,
  });

  customConfig.resolve.extensions.push('.ts', '.tsx');

  return customConfig;
};
