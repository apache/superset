// Beginning of a minimal implementation of the Node.js path API, that doesn't pull in big polyfills.
export function dirname(url) {
  const slashIndex = url && url.lastIndexOf('/');
  return slashIndex >= 0 ? url.substr(0, slashIndex) : '';
}
