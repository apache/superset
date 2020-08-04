/* global Buffer */
import fs from 'fs';
import {toArrayBuffer} from './utils/to-array-buffer.node';

const DEFAULT_OPTIONS = {
  dataType: 'arraybuffer',
  // TODO - this was mostly set to true to make test cases work
  nothrow: true
};

// In a few cases (data URIs, node.js) "files" can be read synchronously
export function readFileSync(url, options = {}) {
  options = getReadFileOptions(options);

  // Only support this if we can also support sync data URL decoding in browser
  // if (isDataURL(url)) {
  //   return decodeDataUri(url);
  // }

  if (!fs || !fs.readFileSync) {
    return null; // throw new Error('Cant load URI synchronously');
  }

  const buffer = fs.readFileSync(url, options, () => {});
  return buffer instanceof Buffer ? toArrayBuffer(buffer) : buffer;
}

// HELPER FUNCTIONS

function getReadFileOptions(options = {}) {
  options = {...DEFAULT_OPTIONS, ...options};
  if (options.responseType === 'text' || options.dataType === 'text') {
    options.encoding = options.encoding || 'utf8';
  }
  return options;
}
