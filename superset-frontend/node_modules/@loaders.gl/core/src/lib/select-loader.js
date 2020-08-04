import {getRegisteredLoaders} from './register-loaders';
import {normalizeLoader} from './loader-utils/normalize-loader';

const EXT_PATTERN = /\.([^.]+)$/;
const DATA_URL_PATTERN = /^data:(.*?)(;|,)/;

// Find a loader that matches file extension and/or initial file content
// Search the loaders array argument for a loader that matches url extension or initial data
// Returns: a normalized loader

// TODO - Need a variant that peeks at streams for parseInBatches
// TODO - Detect multiple matching loaders? Use heuristics to grade matches?
// TODO - Allow apps to pass context to disambiguate between multiple matches (e.g. multiple .json formats)?

export function selectLoader(loaders, url = '', data = null, {nothrow = false} = {}) {
  url = url || '';

  // if only a single loader was provided (not as array), force its use
  // TODO - Should this behaviour be kept and documented?
  if (loaders && !Array.isArray(loaders)) {
    const loader = loaders;
    normalizeLoader(loader);
    return loader;
  }

  // If no loaders provided, get the registered loaders
  loaders = loaders || getRegisteredLoaders();
  normalizeLoaders(loaders);

  url = url.replace(/\?.*/, '');
  let loader = null;
  loader = loader || findLoaderByUrl(loaders, url);
  loader = loader || findLoaderByExamingInitialData(loaders, data);

  // no loader available
  if (!loader) {
    if (nothrow) {
      return null;
    }
    throw new Error(`No valid loader found for ${url}`);
  }

  return loader;
}

function normalizeLoaders(loaders) {
  for (const loader of loaders) {
    normalizeLoader(loader);
  }
}

// TODO - Would be nice to support http://example.com/file.glb?parameter=1
// E.g: x = new URL('http://example.com/file.glb?load=1'; x.pathname
function findLoaderByUrl(loaders, url) {
  // Check for data url
  let match = url.match(DATA_URL_PATTERN);
  const mimeType = match && match[1];
  if (mimeType) {
    return findLoaderByMimeType(loaders, mimeType);
  }
  // Get extension
  match = url.match(EXT_PATTERN);
  const extension = match && match[1];
  const loader = extension && findLoaderByExtension(loaders, extension);
  return loader;
}

function findLoaderByMimeType(loaders, mimeType) {
  for (const loader of loaders) {
    if (loader.mimeTypes && loader.mimeTypes.includes(mimeType)) {
      return loader;
    }
  }
  return null;
}

function findLoaderByExtension(loaders, extension) {
  extension = extension.toLowerCase();

  for (const loader of loaders) {
    for (const loaderExtension of loader.extensions) {
      if (loaderExtension.toLowerCase() === extension) {
        return loader;
      }
    }
  }
  return null;
}

function findLoaderByExamingInitialData(loaders, data) {
  if (!data) {
    return null;
  }

  for (const loader of loaders) {
    if (typeof data === 'string') {
      if (testText(data, loader)) {
        return loader;
      }
    } else if (ArrayBuffer.isView(data)) {
      // Typed Arrays can have offsets into underlying buffer
      if (testBinary(data.buffer, data.byteOffset, loader)) {
        return loader;
      }
    } else if (data instanceof ArrayBuffer) {
      const byteOffset = 0;
      if (testBinary(data, byteOffset, loader)) {
        return loader;
      }
    }
    // TODO Handle streaming case (requires creating a new AsyncIterator)
  }
  return null;
}

function testText(data, loader) {
  return loader.testText && loader.testText(data);
}

function testBinary(data, byteOffset, loader) {
  const type = Array.isArray(loader.test) ? 'array' : typeof loader.test;
  switch (type) {
    case 'function':
      return loader.test(data, loader);

    case 'string':
    case 'array':
      // Magic bytes check: If `loader.test` is a string or array of strings,
      // check if binary data starts with one of those strings
      const tests = Array.isArray(loader.test) ? loader.test : [loader.test];
      return tests.some(test => {
        const magic = getMagicString(data, byteOffset, test.length);
        return test === magic;
      });

    default:
      return false;
  }
}

function getMagicString(arrayBuffer, byteOffset, length) {
  if (arrayBuffer.byteLength <= byteOffset + length) {
    return '';
  }
  const dataView = new DataView(arrayBuffer);
  let magic = '';
  for (let i = 0; i < length; i++) {
    magic += String.fromCharCode(dataView.getUint8(byteOffset + i));
  }
  return magic;
}
