'use strict';

module.exports = function reporter(middlewareOptions, options) {
  const { log, state, stats } = options;

  if (state) {
    const displayStats = middlewareOptions.stats !== false;
    const statsString = stats.toString(middlewareOptions.stats);

    // displayStats only logged
    if (displayStats && statsString.trim().length) {
      if (stats.hasErrors()) {
        log.error(statsString);
      } else if (stats.hasWarnings()) {
        log.warn(statsString);
      } else {
        log.info(statsString);
      }
    }

    let message = 'Compiled successfully.';

    if (stats.hasErrors()) {
      message = 'Failed to compile.';
    } else if (stats.hasWarnings()) {
      message = 'Compiled with warnings.';
    }
    log.info(message);
  } else {
    log.info('Compiling...');
  }
};
