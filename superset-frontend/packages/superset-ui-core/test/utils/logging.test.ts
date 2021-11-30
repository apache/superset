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
    // Explicit is better than implicit
    console.warn = console.error = function mockedConsole(message) {
      throw new Error(message);
    };
  });
  it('should pipe to `console` methods', () => {
    const { logging } = require('@superset-ui/core/src');

    expect(() => {
      logging.debug();
      logging.log();
      logging.info();
    }).not.toThrow();
    expect(() => {
      logging.warn('warn');
    }).toThrow('warn');
    expect(() => {
      logging.error('error');
    }).toThrow('error');

    // to support: npx jest --silent
    const spy = jest.spyOn(logging, 'trace');
    spy.mockImplementation(() => {
      throw new Error('Trace:');
    });
    expect(() => {
      logging.trace();
    }).toThrow('Trace:');
    spy.mockRestore();
  });
  it('should use noop functions when console unavailable', () => {
    const { console } = window;
    Object.assign(window, { console: undefined });
    const { logging } = require('@superset-ui/core/src');

    afterAll(() => {
      Object.assign(window, { console });
    });

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
  });
});
