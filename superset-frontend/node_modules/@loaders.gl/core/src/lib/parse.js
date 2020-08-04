import assert from '../utils/assert';
import {isLoaderObject} from './loader-utils/normalize-loader';
import {mergeLoaderAndUserOptions} from './loader-utils/normalize-options';
import {getUrlFromData} from './loader-utils/get-data';
import {getArrayBufferOrStringFromData} from './loader-utils/get-data';
import {getLoaderContext} from './loader-utils/get-loader-context';
import parseWithWorker from './loader-utils/parse-with-worker';
import {selectLoader} from './select-loader';

export async function parse(data, loaders, options, url) {
  // Signature: parse(data, options, url)
  // Uses registered loaders
  if (loaders && !Array.isArray(loaders) && !isLoaderObject(loaders)) {
    url = options;
    options = loaders;
    loaders = null;
  }

  options = options || {};

  // Extract a url for auto detection
  const autoUrl = getUrlFromData(data, url);

  // Chooses a loader and normalize it
  const loader = selectLoader(loaders, autoUrl, data);

  // Normalize options
  options = mergeLoaderAndUserOptions(options, loader);

  const context = getLoaderContext({url: autoUrl, parse}, options);

  return await parseWithLoader(loader, data, options, context);
}

// TODO: support progress and abort
// TODO: support moving loading to worker
// TODO - should accept loader.parseAsyncIterator and concatenate.
async function parseWithLoader(loader, data, options, context) {
  data = await getArrayBufferOrStringFromData(data, loader);

  // First check for synchronous text parser, wrap results in promises
  if (loader.parseTextSync && typeof data === 'string') {
    options.dataType = 'text';
    return loader.parseTextSync(data, options, context, loader);
  }

  // Check for asynchronous parser
  if (loader.parse) {
    return await loader.parse(data, options, context, loader);
  }

  // Now check for synchronous binary data parser, wrap results in promises
  if (loader.parseSync) {
    return loader.parseSync(data, options, context, loader);
  }

  if (loader.worker) {
    return await parseWithWorker(loader.worker, loader.name, data, options, context, loader);
  }

  // TBD - If asynchronous parser not available, return null
  // => This loader does not work on loaded data and only supports `loadAndParseAsync`
  return assert(false);
}
