const {
  DODOIS_DEV_CDN_PATH,
  DEV_OUTPUT_FOLDER,
  MICROFRONTEND_NAME,
} = require('../../webpackUtils/constants');

const { updateFileWithCss } = require('./helpers');

updateFileWithCss(DEV_OUTPUT_FOLDER, MICROFRONTEND_NAME, DODOIS_DEV_CDN_PATH);
