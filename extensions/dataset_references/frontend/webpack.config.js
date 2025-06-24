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

const path = require("path");
const { ModuleFederationPlugin } = require("webpack").container;
const packageConfig = require("./package");

module.exports = (env, argv) => {
  const isProd = argv.mode === "production";

  return {
    entry: isProd ? {} : "./src/index.tsx",
    mode: isProd ? "production" : "development",
    devServer: {
      port: 3000,
      headers: {
        "Access-Control-Allow-Origin": "*",
      },
    },
    output: {
      filename: isProd ? undefined : "[name].[contenthash].js",
      chunkFilename: "[name].[contenthash].js",
      clean: true,
      path: path.resolve(__dirname, "dist"),
      publicPath: `/api/v1/extensions/${packageConfig.name}/`,
    },
    resolve: {
      extensions: [".ts", ".tsx", ".js", ".jsx"],
    },
    externalsType: "window",
    externals: {
      "@apache-superset/core": "superset",
    },
    module: {
      rules: [
        {
          test: /\.tsx?$/,
          use: "ts-loader",
          exclude: /node_modules/,
        },
        {
          test: /\.(png|jpe?g|gif|svg)$/i,
          type: "asset/resource",
        },
      ],
    },
    plugins: [
      new ModuleFederationPlugin({
        name: packageConfig.name,
        filename: "remoteEntry.[contenthash].js",
        exposes: {
          "./index": "./src/index.tsx",
        },
        shared: {
          react: {
            singleton: true,
            requiredVersion: packageConfig.peerDependencies.react,
            import: false,
          },
          "react-dom": {
            singleton: true,
            requiredVersion: packageConfig.peerDependencies["react-dom"],
            import: false,
          },
          antd: {
            singleton: true,
            requiredVersion: packageConfig.peerDependencies["antd"],
            import: false,
          },
        },
      }),
    ],
  };
};
