import {isLoaderObject} from './loader-utils/normalize-loader';
import {mergeLoaderAndUserOptions} from './loader-utils/normalize-options';
import {getIteratorFromData} from './loader-utils/get-data';
import {getLoaderContext} from './loader-utils/get-loader-context';
import {selectLoader} from './select-loader';

// TODO - remove?
export async function parseInBatchesSync(data, loaders, options, url) {
  // Signature: parseInBatchesSync(data, options, url)
  // Uses registered loaders
  if (!Array.isArray(loaders) && !isLoaderObject(loaders)) {
    url = options;
    options = loaders;
    loaders = null;
  }

  // Chooses a loader and normalizes it
  // TODO - only uses URL, need a selectLoader variant that peeks at first stream chunk...
  const loader = selectLoader(loaders, url, null);

  // Normalize options
  options = mergeLoaderAndUserOptions(options, loader);

  const context = getLoaderContext({url}, options);

  return parseWithLoaderInBatchesSync(loader, data, options, context);
}

function parseWithLoaderInBatchesSync(loader, data, options, context) {
  // Create async iterator adapter for data, and concatenate result
  if (loader.parseInBatchesSync) {
    const inputIterator = getIteratorFromData(data);
    const outputIterator = loader.parseInBatchesSync(inputIterator, options, context, loader);
    return outputIterator;
  }

  throw new Error('parseWithLoaderInBatchesSync not available');
}
