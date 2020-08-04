// TODO - this file is not tested
import assert from '../../utils/assert';

const DEFAULT_OPTIONS = {
  dataType: 'arraybuffer',
  // TODO - this was mostly set to true to make test cases work
  nothrow: true
};

const isDataURL = url => url.startsWith('data:');

// In a few cases (data URIs, files under Node) "files" can be read synchronously
export function readFileSyncBrowser(uri, options) {
  options = getReadFileOptions(options);

  if (isDataURL(uri)) {
    // TODO - removed until decodeDataUri does not depend on Node.js Buffer
    //   return decodeDataUri(uri);
  }

  if (!options.nothrow) {
    // throw new Error('Cant load URI synchronously');
    assert(false);
  }

  return null;
}

// HELPER FUNCTIONS

function getReadFileOptions(options = {}) {
  options = Object.assign({}, DEFAULT_OPTIONS, options);
  options.responseType = options.responseType || options.dataType;
  return options;
}
