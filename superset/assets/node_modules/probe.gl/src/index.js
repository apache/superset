import './init';

export {VERSION} from './lib/utils/globals';

export {default as Log} from './lib/log';
export {COLOR} from './lib/utils/color';

export {default as Stats} from './lib/stats';

// DOM logging
import {enableDOMLogging} from './lib/utils/log-to-dom';

export const experimental = {
  enableDOMLogging
};

// Default export is a log
import {default as Log} from './lib/log';
export default new Log({id: 'probe.gl'});
