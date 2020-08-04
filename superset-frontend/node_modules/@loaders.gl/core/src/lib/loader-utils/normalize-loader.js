import assert from '../../utils/assert';

export function isLoaderObject(loader) {
  if (!loader) {
    return false;
  }

  if (Array.isArray(loader)) {
    loader = loader[0];
  }

  const hasParser =
    loader.parseTextSync ||
    loader.parseSync ||
    loader.parse ||
    loader.loadAndParse ||
    loader.parseStream || // TODO Replace with parseInBatches
    loader.parseInBatches ||
    // loader.parseInBatchesSync || // Optimization only, parseInBatches needed
    loader.worker;

  return hasParser;
}

export function normalizeLoader(loader) {
  assert(isLoaderObject(loader));

  // NORMALIZE [LOADER, OPTIONS] => LOADER

  // If [loader, options], create a new loaders object with options merged in
  let options;
  if (Array.isArray(loader)) {
    options = loader[1];
    loader = loader[0];
    loader = {
      ...loader,
      options: {...loader.options, ...options}
    };
  }

  // NORMALIZE LOADER.EXTENSIONS

  // Remove `extension`` prop, replace with `extensions``
  if (loader.extension) {
    loader.extensions = loader.extensions || loader.extension;
    delete loader.extension;
  }

  // Ensure loader.extensions is an array
  if (!Array.isArray(loader.extensions)) {
    loader.extensions = [loader.extensions];
  }

  assert(loader.extensions && loader.extensions.length > 0 && loader.extensions[0]);

  // NORMALIZE text and binary flags

  // Ensure at least one of text/binary flags are properly set
  if (loader.parseTextSync) {
    loader.text = true;
  }

  if (!loader.text) {
    loader.binary = true;
  }

  // TODO - Does adding a default MIME type add any value?
  /*
  if (!loader.mimeType) {
    if (loader.binary) {
      // TODO - do we need separate mime types for binary and text formats?
      loader.mimeType = 'application/octet-stream';
    }
  }
  */

  return loader;
}
