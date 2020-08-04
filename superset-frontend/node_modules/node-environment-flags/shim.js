'use strict';

const getPolyfill = require('./polyfill');

module.exports = () => {
  const polyfill = getPolyfill();
  if (polyfill !== process.allowedNodeEnvironmentFlags) {
    Object.defineProperty(process, 'allowedNodeEnvironmentFlags', {
      writable: true,
      enumerable: true,
      configurable: true,
      value: polyfill
    });
  }
  return polyfill;
};
