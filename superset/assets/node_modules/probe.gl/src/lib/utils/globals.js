/* global process, global, window, document, console */

// Check if in browser by duck-typing Node context
const isBrowser =
  typeof process !== 'object' ||
  String(process) !== '[object process]' ||
  process.browser;

// Provide fallbacks for browser globals
const window_ = typeof window !== 'undefined' ? window : global;
const document_ = typeof document !== 'undefined' ? document : {};

// Provide fallbacks for Node globals
const global_ = typeof global !== 'undefined' ? global : window;
const process_ = typeof process === 'object' ? process : {};

// Extract injected version from package.json (injected by babel plugin)
/* global __VERSION__ */
const VERSION = typeof __VERSION__ !== 'undefined' ? __VERSION__ : 'untranspiled source';

export {
  window_ as window,
  document_ as document,
  global_ as global,
  process_ as process,
  console,
  isBrowser,
  VERSION
};
