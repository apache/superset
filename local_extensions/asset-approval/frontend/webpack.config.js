const path = require("path");
const { ModuleFederationPlugin } = require("webpack").container;
const extensionConfig = require("../extension.json");

module.exports = () => ({
  entry: {},
  mode: "production",
  output: {
    clean: true,
    chunkFilename: "[name].[contenthash].js",
    path: path.resolve(__dirname, "dist"),
    publicPath: `/api/v1/extensions/${extensionConfig.publisher}/${extensionConfig.name}/`,
  },
  resolve: { extensions: [".ts", ".tsx", ".js", ".jsx"] },
  module: {
    rules: [{ test: /\.tsx?$/, use: "ts-loader", exclude: /node_modules/ }],
  },
  plugins: [
    new ModuleFederationPlugin({
      // Must equal manifest.frontend.moduleFederationName, which the build
      // tool derives from publisher and name. A mismatch builds and serves
      // fine, and the host then cannot find the container on window.
      name: "preset_assetApproval",
      filename: "remoteEntry.[contenthash].js",
      exposes: { "./index": "./src/index.tsx" },
      shared: {
        react: { singleton: true, import: false },
        "react-dom": { singleton: true, import: false },
        "@apache-superset/core": { singleton: true, import: false },
      },
    }),
  ],
});
