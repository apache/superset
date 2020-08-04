import checkIfBrowser from '../env/is-browser';

export {self, window, global, document, process, console} from '../env/globals';

// Extract injected version from package.json (injected by babel plugin)
/* global __VERSION__ */
export const VERSION = typeof __VERSION__ !== 'undefined' ? __VERSION__ : 'untranspiled source';

export const isBrowser = checkIfBrowser();
