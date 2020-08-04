import {normalizeLoader} from './loader-utils/normalize-loader';

let registeredLoaders = [];

export function registerLoaders(loaders) {
  loaders = Array.isArray(loaders) ? loaders : [loaders];

  for (const loader of loaders) {
    const normalizedLoader = normalizeLoader(loader);
    if (!registeredLoaders.find(registeredLoader => normalizedLoader === registeredLoader)) {
      // add to the beginning of the registeredLoaders, so the last registeredLoader get picked
      registeredLoaders.unshift(normalizedLoader);
    }
  }
}

export function getRegisteredLoaders() {
  return registeredLoaders;
}

// For testing
export function _unregisterLoaders() {
  registeredLoaders = [];
}
