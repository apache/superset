/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

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
      name: packageConfig.name,
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
