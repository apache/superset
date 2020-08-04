import {isFileReadable} from '../javascript-utils/is-type';
import {fetchFile} from './fetch/fetch-file';
import {isLoaderObject} from './loader-utils/normalize-loader';
import {mergeLoaderAndUserOptions} from './loader-utils/normalize-options';
import {selectLoader} from './select-loader';

import {parse} from './parse';
import {parseInBatches} from './parse-in-batches';

export async function loadInBatches(url, loaders, options) {
  const response = await fetchFile(url, options);
  return parseInBatches(response, loaders, options, url);
}

// Note: Load does duplicate a lot of parse.
// Works like parse but can call `loadAndParse` for parsers that need to do their own loading
// it can also call fetchFile on string urls, which `parse` won't do.
export async function load(url, loaders, options) {
  // Signature: load(url, options)
  if (!Array.isArray(loaders) && !isLoaderObject(loaders)) {
    options = loaders;
    loaders = null;
  }

  // Extract a url for auto detection
  const autoUrl = isFileReadable(url) ? url.name : url;

  // Initial loader autodection (Use registered loaders if none provided)
  // This only uses URL extensions to detect loaders.
  const loader = selectLoader(loaders, autoUrl, null, {nothrow: true});

  if (loader) {
    // Some loaders do not separate reading and parsing of data (e.g ImageLoader)
    // These can only be handled by `load`, not `parse`
    // TODO - ImageLoaders can be rewritten to separate load and parse, phase out this variant?
    if (loader.loadAndParse) {
      const loaderOptions = mergeLoaderAndUserOptions(options, loader);
      return await loader.loadAndParse(url, loaderOptions);
    }
  }

  // at this point, data can be binary or text
  let data = url;
  if (isFileReadable(data) || typeof data === 'string') {
    data = await fetchFile(url, options);
  }

  // Fall back to parse
  // Note: An improved round of autodetection is possible now that data has been loaded
  // This means that another loader might be selected
  return parse(data, loaders, options, url);
}
