module.exports = async ({ config }) => {
  config.module.rules.push({
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

  config.resolve.extensions.push('.ts', '.tsx');

  return config;
};
