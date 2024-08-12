/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable global-require */
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
describe('logging', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.resetAllMocks();
  });

  const { console } = window;
  afterAll(() => {
    Object.assign(window, { console });
  });

  it('should pipe to `console` methods', () => {
    const { logging } = require('@superset-ui/core');

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
    const { logging } = require('@superset-ui/core');

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
});
