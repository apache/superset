import isBrowser from './utils/is-browser';
import {global} from './utils/globals';
import log from './utils/log';
// Version detection using babel plugin
/* global __VERSION__ */
const VERSION = typeof __VERSION__ !== 'undefined' ? __VERSION__ : 'untranspiled source';

const STARTUP_MESSAGE = 'set luma.log.priority=1 (or higher) to trace rendering';
// Assign luma.log.priority in console to control logging: \
// 0: none, 1: minimal, 2: verbose, 3: attribute/uniforms, 4: gl logs
// luma.log.break[], set to gl funcs, luma.log.profile[] set to model names`;

if (global.luma && global.luma.VERSION !== VERSION) {
  throw new Error(`luma.gl - multiple VERSIONs detected: ${global.luma.VERSION} vs ${VERSION}`);
}

if (!global.luma) {
  if (isBrowser) {
    log.log(0, `luma.gl ${VERSION} - ${STARTUP_MESSAGE}`)();
  }

  global.luma = global.luma || {
    VERSION,
    version: VERSION,
    log,

    // A global stats object that various components can add information to
    // E.g. see webgl/resource.js
    stats: {},

    // Keep some luma globals in a sub-object
    // This allows us to dynamically detect if certain modules have been
    // included (such as IO and headless) and enable related functionality,
    // without unconditionally requiring and thus bundling big dependencies
    // into the app.
    globals: {
      modules: {},
      nodeIO: {}
    }
  };
}

export {global};
export default global.luma;
