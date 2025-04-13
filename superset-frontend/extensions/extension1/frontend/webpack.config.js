const path = require('path');
const { ModuleFederationPlugin } = require('webpack').container;
const CopyWebpackPlugin = require('copy-webpack-plugin');
const packageConfig = require('./package');

module.exports = {
  entry: './src/index.tsx',
  mode: 'development',
  devServer: {
    port: 3000,
    headers: {
      'Access-Control-Allow-Origin': '*',
    },
  },
  output: {
    clean: true,
    path: path.resolve(__dirname, 'dist'),
    publicPath: `/api/v1/extensions/${packageConfig.name}/`,
  },
  resolve: {
    extensions: ['.ts', '.tsx', '.js', '.jsx'],
  },
  externalsType: 'window',
  externals: {
    '@apache-superset/types': 'superset',
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
    ],
  },
  plugins: [
    new ModuleFederationPlugin({
      name: 'extension1',
      filename: 'remoteEntry.js',
      exposes: {
        './index': './src/index.tsx',
      },
      shared: {
        react: {
          singleton: true,
          requiredVersion: packageConfig.peerDependencies.react,
          import: false,
        },
        'react-dom': {
          singleton: true,
          requiredVersion: packageConfig.peerDependencies['react-dom'],
          import: false,
        },
        'antd-v5': {
          singleton: true,
          requiredVersion: 'npm:antd@^5.18.0',
          import: false,
        },
      },
    }),
    new CopyWebpackPlugin({
      patterns: [{ from: './src/publicAPI.d.ts', to: './publicAPI.d.ts' }],
    }),
  ],
};
