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
const path = require('path');
const fs = require('fs');
const { ModuleFederationPlugin } = require('webpack').container;
const packageConfig = require('./package.json');
const extensionConfig = require('./extension.json');

const MODULE_FEDERATION_NAME = 'apacheSuperset_altChatbot';

/**
 * Emits the `manifest.json` the host reads from the extension `dist/` root.
 *
 * The host (`superset/extensions/utils.py`) expects an extension dist laid out
 * as `dist/manifest.json` plus the federated bundle under `dist/frontend/dist/`.
 * The manifest carries `extension.json` verbatim, plus the composite `id` and a
 * `frontend` block naming the content-hashed `remoteEntry` so the host can load
 * the right file. Because the hash is only known after the build, the manifest
 * is written from the final asset names rather than checked in.
 */
class EmitManifestPlugin {
  apply(compiler) {
    compiler.hooks.afterEmit.tap('EmitManifestPlugin', compilation => {
      const assets = Object.keys(compilation.assets);
      const remoteEntry = assets.find(name => /^remoteEntry\..*\.js$/.test(name));
      if (!remoteEntry) {
        throw new Error('EmitManifestPlugin: no remoteEntry asset was emitted');
      }
      const manifest = {
        ...extensionConfig,
        id: `${extensionConfig.publisher}.${extensionConfig.name}`,
        frontend: {
          remoteEntry,
          moduleFederationName: MODULE_FEDERATION_NAME,
        },
      };
      fs.writeFileSync(
        path.resolve(__dirname, 'dist', 'manifest.json'),
        `${JSON.stringify(manifest, null, 2)}\n`,
      );
    });
  }
}

module.exports = (env, argv) => {
  const isProd = argv.mode === 'production';

  return {
    entry: isProd ? {} : './src/index.tsx',
    mode: isProd ? 'production' : 'development',
    devtool: isProd ? false : 'eval-cheap-module-source-map',
    devServer: {
      port: 3031,
      headers: { 'Access-Control-Allow-Origin': '*' },
    },
    output: {
      clean: true,
      filename: isProd ? undefined : '[name].[contenthash].js',
      chunkFilename: '[name].[contenthash].js',
      path: path.resolve(__dirname, 'dist', 'frontend', 'dist'),
      publicPath: `/api/v1/extensions/${extensionConfig.publisher}/${extensionConfig.name}/`,
    },
    resolve: { extensions: ['.ts', '.tsx', '.js', '.jsx'] },
    externalsType: 'window',
    externals: { '@apache-superset/core': 'superset' },
    module: {
      rules: [
        { test: /\.tsx?$/, use: 'ts-loader', exclude: /node_modules/ },
      ],
    },
    plugins: [
      new ModuleFederationPlugin({
        name: MODULE_FEDERATION_NAME,
        filename: 'remoteEntry.[contenthash].js',
        exposes: { './index': './src/index.tsx' },
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
        },
      }),
      new EmitManifestPlugin(),
    ],
  };
};
