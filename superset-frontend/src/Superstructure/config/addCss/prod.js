const {
  DODOIS_CDN_PATH,
  PROD_OUTPUT_FOLDER,
  MICROFRONTEND_NAME,
} = require('../../webpackUtils/constants');

const { updateFileWithCss } = require('./helpers');

updateFileWithCss(PROD_OUTPUT_FOLDER, MICROFRONTEND_NAME, DODOIS_CDN_PATH);
