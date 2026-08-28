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
const fs = require('fs');
const {
  entrypointSizeByExt,
  main,
} = require('../../scripts/bundle-size-summary');

function mockStats(entrypoints) {
  jest
    .spyOn(fs, 'readFileSync')
    .mockReturnValue(JSON.stringify({ entrypoints }));
}

function mockExit() {
  return jest.spyOn(process, 'exit').mockImplementation(() => {
    throw new Error('process.exit called');
  });
}

const originalArgv = process.argv;

afterEach(() => {
  jest.restoreAllMocks();
  process.argv = originalArgv;
});

test('entrypointSizeByExt sums only assets matching the given extension', () => {
  const entrypoint = {
    assets: [
      { name: 'spa.entry.js', size: 100 },
      { name: 'spa.entry.js.map', size: 500 },
      { name: 'spa.entry.css', size: 20 },
    ],
  };
  expect(entrypointSizeByExt(entrypoint, '.js')).toBe(100);
  expect(entrypointSizeByExt(entrypoint, '.css')).toBe(20);
});

test('entrypointSizeByExt returns 0 when the entrypoint has no assets', () => {
  expect(entrypointSizeByExt({}, '.js')).toBe(0);
});

test('main prints byte totals for every tracked entrypoint', () => {
  mockStats({
    spa: { assets: [{ name: 'spa.js', size: 100 }] },
    embedded: { assets: [{ name: 'embedded.js', size: 50 }] },
  });
  const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  process.argv = ['node', 'bundle-size-summary.js', 'stats.json'];

  main();

  const printed = JSON.parse(logSpy.mock.calls[0][0]);
  expect(printed).toEqual([
    { name: 'spa entrypoint (JS)', unit: 'bytes', value: 100 },
    { name: 'spa entrypoint (CSS)', unit: 'bytes', value: 0 },
    { name: 'embedded entrypoint (JS)', unit: 'bytes', value: 50 },
    { name: 'embedded entrypoint (CSS)', unit: 'bytes', value: 0 },
  ]);
});

test('main exits with an error when a tracked entrypoint is missing from stats.json', () => {
  mockStats({ spa: { assets: [] } });
  const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  mockExit();
  process.argv = ['node', 'bundle-size-summary.js', 'stats.json'];

  expect(main).toThrow('process.exit called');
  expect(errorSpy).toHaveBeenCalledWith(
    expect.stringContaining('missing the "embedded" entrypoint'),
  );
});

test('main exits with an error when stats.json has no `entrypoints` key', () => {
  jest.spyOn(fs, 'readFileSync').mockReturnValue(JSON.stringify({}));
  const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  mockExit();
  process.argv = ['node', 'bundle-size-summary.js', 'stats.json'];

  expect(main).toThrow('process.exit called');
  expect(errorSpy).toHaveBeenCalledWith(
    expect.stringContaining('no `entrypoints` key'),
  );
});

test('main prints a usage message and exits when no stats path is given', () => {
  const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  mockExit();
  process.argv = ['node', 'bundle-size-summary.js'];

  expect(main).toThrow('process.exit called');
  expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('Usage:'));
});
