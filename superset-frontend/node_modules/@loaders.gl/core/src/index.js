import {parse} from './lib/parse';
import {parseSync} from './lib/parse-sync';
import {fetchFile} from './lib/fetch/fetch-file';
import {load} from './lib/load';
import {resolvePath} from './lib/fetch/file-aliases';
import {global} from './utils/globals';
import * as path from './lib/path/path';

// PATH

export {path};

// FILE READING AND WRITING
export {setPathPrefix, getPathPrefix, resolvePath} from './lib/fetch/file-aliases.js';
export {fetchFile} from './lib/fetch/fetch-file';
export {readFileSync} from './lib/fetch/read-file';
export {writeFile, writeFileSync} from './lib/fetch/write-file';
export {
  getErrorMessageFromResponseSync as _getErrorMessageFromResponseSync,
  getErrorMessageFromResponse as _getErrorMessageFromResponse
} from './lib/fetch/fetch-error-message';

// FILE PARSING AND ENCODING
export {registerLoaders} from './lib/register-loaders';

// LOADING (READING + PARSING)
export {parse} from './lib/parse';
export {parseSync} from './lib/parse-sync';
export {parseInBatches} from './lib/parse-in-batches';
export {parseInBatchesSync} from './lib/parse-in-batches-sync';
export {load, loadInBatches} from './lib/load';

// ENCODING AND SAVING
export {encode, encodeSync, encodeInBatches} from './lib/encode';
export {save, saveSync} from './lib/save';

// "JAVASCRIPT" UTILS
export {
  isPromise,
  isIterable,
  isAsyncIterable,
  isIterator,
  isFetchResponse,
  isReadableStream,
  isWritableStream
} from './javascript-utils/is-type';

export {toArrayBuffer} from './javascript-utils/binary-utils';

// ITERATOR UTILS
export {getStreamIterator} from './javascript-utils/stream-utils';

export {
  forEach,
  concatenateAsyncIterator,
  lineAsyncIterator,
  textDecoderAsyncIterator,
  numberedLineAsyncIterator
} from './javascript-utils/async-iterator-utils';

// CORE UTILS
export {isBrowser, self, window, global, document} from './utils/globals';
export {default as assert} from './utils/assert';

// EXPERIMENTAL
export {selectLoader as _selectLoader} from './lib/select-loader';

export {default as _WorkerThread} from './worker-utils/worker-thread';
export {default as _WorkerFarm} from './worker-utils/worker-farm';
export {default as _WorkerPool} from './worker-utils/worker-pool';

export {default as _fetchProgress} from './lib/progress/fetch-progress';

// FOR TESTING
export {_unregisterLoaders} from './lib/register-loaders';

// DEPRECATED

// Use @loaders.gl/polyfills and global symbols instead
export const TextEncoder = global.TextEncoder;
export const TextDecoder = global.TextDecoder;

// Returns a promise that resolves to a readable stream
export async function createReadStream(url, options) {
  // eslint-disable-next-line
  console.warn('createReadStream() deprecated, use fetch().then(resp => resp.body)');
  url = resolvePath(url);
  const response = await fetchFile(url, options);
  return response.body;
}

export function parseFile(...args) {
  console.warn('parse() deprecated, use parse()'); // eslint-disable-line
  return parse(...args);
}

export function parseFileSync(...args) {
  console.warn('parseSync() deprecated, use parseSync()'); // eslint-disable-line
  return parseSync(...args);
}

export function loadFile(...args) {
  console.warn('loadFile() deprecated, use load()'); // eslint-disable-line
  return load(...args);
}
