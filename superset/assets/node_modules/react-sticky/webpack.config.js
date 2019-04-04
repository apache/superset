const path = require("path");
const webpack = require("webpack");

const isLive = process.env.NODE_ENV === "production";

module.exports = {
  devtool: isLive ? "source-map" : "cheap-eval-source-map",
  entry: {
    demos: path.resolve("examples", "index.js")
  },
  output: {
    path: path.join(__dirname, "examples"),
    filename: "bundle.js"
  },
  module: {
    loaders: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        loader: "babel-loader"
      }
    ]
  },
  devServer: {
    contentBase: path.join(__dirname, "examples"),
    publicPath: "/",
    compress: true,
    port: 9000,
    historyApiFallback: true
  }
};
