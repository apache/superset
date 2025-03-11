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
    path: path.resolve(__dirname, 'dist'),
    filename: 'bundle.js',
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
      name: 'extension2',
      filename: 'remoteEntry.js',
      exposes: {
        './ExtensionExample': './src/index.tsx',
      },
      remotes: {
        superset: 'superset@http://localhost:9000/static/assets/remoteEntry.js',
      },
      shared: {
        react: {
          singleton: true,
          eager: true,
          requiredVersion: packageConfig.dependencies.react,
        },
        'react-dom': {
          singleton: true,
          eager: true,
          requiredVersion: packageConfig.dependencies['react-dom'],
        },
        'antd-v5': {
          singleton: true,
          eager: true,
          requiredVersion: 'npm:antd@^5.18.0',
        },
      },
    }),
  ],
};
