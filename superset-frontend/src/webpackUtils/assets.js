const { STATIC_FILES_DIR } = require('./constants');

const rulesStaticAssets = ROOT_DIR => [
  /* for css linking images (and viz plugin thumbnails) */
  {
    test: /\.png$/,
    issuer: {
      exclude: /\/src\/assets\/staticPages\//,
    },
    loader: 'url-loader',
    options: {
      limit: 10000,
      outputPath: STATIC_FILES_DIR,
      name: '[name].[hash:8].[ext]',
    },
  },
  {
    test: /\.svg(\?v=\d+\.\d+\.\d+)?$/,
    issuer: {
      test: /\.(j|t)sx?$/,
    },
    use: ['@svgr/webpack'],
  },
  {
    test: /\.(jpg|gif)$/,
    loader: 'file-loader',
    options: {
      name: '[name].[hash:8].[ext]',
      outputPath: STATIC_FILES_DIR,
    },
  },
  /* for font-awesome */
  {
    test: /\.woff(2)?(\?v=[0-9]\.[0-9]\.[0-9])?$/,
    loader: 'url-loader?limit=10000&mimetype=application/font-woff',
    options: {
      esModule: false,
      outputPath: STATIC_FILES_DIR,
    },
  },
  {
    test: /\.(ttf|eot|svg)(\?v=[0-9]\.[0-9]\.[0-9])?$/,
    loader: 'file-loader',
    options: {
      esModule: false,
      outputPath: STATIC_FILES_DIR,
    },
  },
  {
    test: /\.ya?ml$/,
    include: ROOT_DIR,
    loader: 'js-yaml-loader',
  },
];

module.exports = {
  rulesStaticAssets,
};
