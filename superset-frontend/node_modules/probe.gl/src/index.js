import './init';
import {default as Log} from './lib/log';

export {VERSION} from './utils/globals';

// ENVIRONMENT
export {self, window, global, document, process, console} from './env/globals';
export {default as isBrowser, isBrowserMainThread} from './env/is-browser';
export {default as getBrowser, isMobile} from './env/get-browser';
export {default as isElectron} from './env/is-electron';

// ENVIRONMENT'S ASSERT IS 5-15KB, SO WE PROVIDE OUR OWN
export {default as assert} from './utils/assert';

// LOGGING
export {default as Log} from './lib/log';
export {COLOR} from './utils/color';

// DEFAULT EXPORT IS A LOG INSTANCE
export default new Log({id: 'probe.gl'});

// UTILITIES
export {addColor} from './utils/color';
export {leftPad, rightPad} from './utils/formatters';
export {autobind} from './utils/autobind';
export {default as LocalStorage} from './utils/local-storage';
export {default as getHiResTimestamp} from './utils/hi-res-timestamp';

// DEPRECATED (Should be imported directly from @probe.gl/stats)
export {Stats, Stat} from '@probe.gl/stats';
