beforeEach(() => {
  jest.resetModules();
  jest.resetAllMocks();
});

it('should pipe to `console` methods', () => {
  const { logging } = require('@apache-superset/core');

  jest.spyOn(logging, 'debug').mockImplementation();
  jest.spyOn(logging, 'log').mockImplementation();
  jest.spyOn(logging, 'info').mockImplementation();
  expect(() => {
    logging.debug();
    logging.log();
    logging.info();
  }).not.toThrow();

  jest.spyOn(logging, 'warn').mockImplementation(() => {
    throw new Error('warn');
  });
  expect(() => logging.warn()).toThrow('warn');

  jest.spyOn(logging, 'error').mockImplementation(() => {
    throw new Error('error');
  });
  expect(() => logging.error()).toThrow('error');

  jest.spyOn(logging, 'trace').mockImplementation(() => {
    throw new Error('Trace:');
  });
  expect(() => logging.trace()).toThrow('Trace:');
});

it('should use noop functions when console unavailable', () => {
  Object.assign(window, { console: undefined });
  const { logging } = require('@apache-superset/core');

  expect(() => {
    logging.debug();
    logging.log();
    logging.info();
    logging.warn('warn');
    logging.error('error');
    logging.trace();
    logging.table([
      [1, 2],
      [3, 4],
    ]);
  }).not.toThrow();
  Object.assign(window, { console });
});
