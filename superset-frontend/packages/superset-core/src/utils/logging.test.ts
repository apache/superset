/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
export {}; // ensure this file is treated as a module so top-level declarations don't leak into global scope

type LoggingModule = typeof import('./index');

const loadLogging = (): LoggingModule['logging'] => {
  let logging: LoggingModule['logging'] | undefined;
  jest.isolateModules(() => {
    ({ logging } = jest.requireActual<LoggingModule>(
      '@apache-superset/core/utils',
    ));
  });
  return logging!;
};

beforeEach(() => {
  jest.resetAllMocks();
});

test('should pipe to `console` methods', () => {
  const logging = loadLogging();

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

test('should use noop functions when console unavailable', () => {
  const originalConsole = window.console;
  Object.assign(window, { console: undefined });
  try {
    const logging = loadLogging();

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
  } finally {
    Object.assign(window, { console: originalConsole });
  }
});
