import {selectLoader} from './select-loader';
import {isLoaderObject} from './loader-utils/normalize-loader';
import {mergeLoaderAndUserOptions} from './loader-utils/normalize-options';
import {getArrayBufferOrStringFromDataSync} from './loader-utils/get-data';
import {getLoaderContext} from './loader-utils/get-loader-context';

export function parseSync(data, loaders, options, url) {
  // Signature: parseSync(data, options, url)
  // Uses registered loaders
  if (!Array.isArray(loaders) && !isLoaderObject(loaders)) {
    url = options;
    options = loaders;
    loaders = null;
  }

  // Chooses a loader and normalize it
  const loader = selectLoader(loaders, url, data);
  // Note: if nothrow option was set, it is possible that no loader was found, if so just return null
  if (!loader) {
    return null;
  }

  // Normalize options
  options = mergeLoaderAndUserOptions(options, loader);

  const context = getLoaderContext({url, parseSync}, options);

  return parseWithLoaderSync(loader, data, options, context);
}

// TODO - should accept loader.parseSync/parse and generate 1 chunk asyncIterator
function parseWithLoaderSync(loader, data, options, context) {
  data = getArrayBufferOrStringFromDataSync(data, loader);

  if (loader.parseTextSync && typeof data === 'string') {
    return loader.parseTextSync(data, options, context, loader);
  }

  if (loader.parseSync) {
    return loader.parseSync(data, options, context, loader);
  }

  // TBD - If synchronous parser not available, return null
  throw new Error(`Could not parse ${context.url || 'data'} using ${loader.name} loader`);
}
