/**
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

// The build config, as superset-extensions-cli scaffolds it, plus an alias
// that compiles the artifact SDK from its sources, so that it needs no build
// of its own.
const path = require('path');
const { ModuleFederationPlugin } = require('webpack').container;
const packageConfig = require('./package');
const extensionConfig = require('../extension.json');

const ARTIFACT_SDK = path.resolve(__dirname, '../sdk/browser/src');

module.exports = (env, argv) => {
  const isProd = argv.mode === 'production';

  return {
    entry: isProd ? {} : './src/index.tsx',
    mode: isProd ? 'production' : 'development',
    devServer: {
      port: 3000,
      headers: {
        'Access-Control-Allow-Origin': '*',
      },
    },
    output: {
      clean: true,
      filename: isProd ? undefined : '[name].[contenthash].js',
      chunkFilename: '[name].[contenthash].js',
      path: path.resolve(__dirname, 'dist'),
      publicPath: `/api/v1/extensions/${extensionConfig.publisher}/${extensionConfig.name}/`,
    },
    resolve: {
      extensions: ['.ts', '.tsx', '.js', '.jsx'],
      alias: {
        '@superset-oss/artifacts-sdk$': ARTIFACT_SDK,
      },
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
        // superset-extensions-cli derives it: publisherCamel_nameCamel.
        name: 'supersetOss_artifacts',
        filename: 'remoteEntry.[contenthash].js',
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
          // The host injects a copy scoped to this extension.
          '@apache-superset/core': {
            singleton: true,
            import: false,
          },
        },
      }),
    ],
  };
};
