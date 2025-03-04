// eslint-disable-next-line import/no-extraneous-dependencies
const MiniCssExtractPlugin = require('mini-css-extract-plugin');

const rulesStyles = (ROOT_DIR, isProd) => [
  {
    test: /\.css$/,
    include: [ROOT_DIR, /superset-ui.+\/src/],
    use: [
      MiniCssExtractPlugin.loader,
      {
        loader: 'css-loader',
        options: {
          sourceMap: !isProd,
        },
      },
    ],
  },
  {
    test: /\.less$/,
    include: ROOT_DIR,
    use: [
      MiniCssExtractPlugin.loader,
      {
        loader: 'css-loader',
        options: {
          sourceMap: !isProd,
        },
      },
      {
        loader: 'less-loader',
        options: {
          sourceMap: !isProd,
          javascriptEnabled: true,
        },
      },
    ],
  },
];

module.exports = {
  rulesStyles,
};
