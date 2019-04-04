module.exports = {
  mode: 'development',
  module: {
    rules: [
      {
        test: /(\.js|\.jsx)$/,
        use: {loader: 'babel-loader'},
        exclude: /node_modules/
      },
    ],
  },
  output: {
    library: 'ReactAce',
    libraryTarget: 'umd',
  },
  resolve: {
    extensions: ['.jsx', '.js', '.tsx'],
  },
};
