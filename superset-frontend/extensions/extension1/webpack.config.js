const path = require('path');
const { ModuleFederationPlugin } = require('webpack').container;
const packageConfig = require('./package.json');

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
        './ExtensionExample': './src/index.tsx',
      },
      shared: {
        react: {
          singleton: true,
          requiredVersion: packageConfig.dependencies.react,
          import: false,
        },
        'react-dom': {
          singleton: true,
          requiredVersion: packageConfig.dependencies['react-dom'],
          import: false,
        },
        'antd-v5': {
          singleton: true,
          requiredVersion: 'npm:antd@^5.18.0',
          import: false,
        },
      },
    }),
  ],
};
