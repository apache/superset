import NullLog from './null-log';

export function mergeLoaderAndUserOptions(options, loader) {
  options = Object.assign(
    {},
    loader && loader.DEFAULT_OPTIONS,
    loader && loader.defaultOptions,
    loader && loader.options,
    options,
    // TODO - explain why this option is needed for parsing
    {
      dataType: 'arraybuffer'
    }
  );

  // LOGGING

  // options.log can be set to `null` to defeat logging
  if (options.log === null) {
    options.log = new NullLog();
  }
  // log defaults to console
  if (!('log' in options)) {
    /* global console */
    options.log = console;
  }

  return options;
}
