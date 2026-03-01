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
beforeEach(() => {
  vi.resetModules();
  vi.resetAllMocks();
});

test('should pipe to `console` methods', () => {
  const { logging } = require('@apache-superset/core');

  vi.spyOn(logging, 'debug').mockImplementation();
  vi.spyOn(logging, 'log').mockImplementation();
  vi.spyOn(logging, 'info').mockImplementation();
  expect(() => {
    logging.debug();
    logging.log();
    logging.info();
  }).not.toThrow();

  vi.spyOn(logging, 'warn').mockImplementation(() => {
    throw new Error('warn');
  });
  expect(() => logging.warn()).toThrow('warn');

  vi.spyOn(logging, 'error').mockImplementation(() => {
    throw new Error('error');
  });
  expect(() => logging.error()).toThrow('error');

  vi.spyOn(logging, 'trace').mockImplementation(() => {
    throw new Error('Trace:');
  });
  expect(() => logging.trace()).toThrow('Trace:');
});

test('should use noop functions when console unavailable', () => {
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
