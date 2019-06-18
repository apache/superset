module.exports = async ({ config }) => {
  config.module.rules.push({
    loader: require.resolve('babel-loader'),
    options: {
      presets: [
        ['@babel/preset-env', { useBuiltIns: 'entry' }],
        '@babel/preset-react',
        '@babel/preset-typescript',
      ],
      plugins: [
        '@babel/plugin-proposal-object-rest-spread',
        '@babel/plugin-proposal-class-properties',
        '@babel/plugin-syntax-dynamic-import',
      ],
    },
    test: /\.tsx?$/,
    exclude: /node_modules/,
  });

  config.resolve.extensions.push('.ts', '.tsx');

  return config;
};
