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
// Mark this file as a module so its top-level declarations stay file-scoped
// (the file has no imports; modules are loaded via require() inside tests).
export {};

// Stable mock references so they survive jest.resetModules() between tests.
const mockLogging = { debug: jest.fn(), warn: jest.fn(), error: jest.fn() };
const mockInitPreamble = jest.fn();
const mockRender = jest.fn();

jest.mock('src/public-path', () => ({}));

jest.mock('query-string', () => ({ parse: jest.fn(), stringify: jest.fn() }));

jest.mock('@apache-superset/core/utils', () => ({
  logging: mockLogging,
}));

jest.mock('src/preamble', () => mockInitPreamble);

jest.mock('react-dom/client', () => ({
  createRoot: () => ({ render: mockRender, unmount: jest.fn() }),
}));

// Menu is imported dynamically inside menu.tsx; a simple stub is enough.
jest.mock(
  'src/features/home/Menu',
  () => ({ __esModule: true, default: () => null }),
  {
    virtual: true,
  },
);

jest.mock('./store', () => ({ setupStore: () => ({}) }));

jest.mock('src/utils/getBootstrapData', () => ({
  __esModule: true,
  default: () => ({
    common: { menu_data: {}, application_root: '/' },
  }),
  applicationRoot: () => '/',
}));

const flush = async () => {
  // Several microtask hops: initPreamble -> dynamic import() -> render.
  for (let i = 0; i < 20; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    await new Promise(resolve => setTimeout(resolve, 0));
  }
};

describe('views/menu.tsx', () => {
  beforeEach(() => {
    jest.resetModules();
    mockRender.mockReset();
    mockInitPreamble.mockReset();
    mockLogging.error.mockClear();
    document.body.innerHTML = '<div id="app-menu"></div>';
  });

  test('renders the menu even when initPreamble rejects', async () => {
    // The language pack failed to load, but the menu should still render
    // (falling back to English) because the import/render runs in `finally`.
    // The preamble rejection still propagates to the outer handler and is
    // logged, but rendering is not blocked by it.
    mockInitPreamble.mockRejectedValue(new Error('preamble failed'));

    require('./menu');
    await flush();

    expect(mockRender).toHaveBeenCalled();
    expect(mockLogging.error).toHaveBeenCalledWith(
      'Unhandled error during menu initialization',
      expect.any(Error),
    );
  });

  test('logs an error when menu render fails', async () => {
    mockInitPreamble.mockResolvedValue(true);
    mockRender.mockImplementation(() => {
      throw new Error('render blew up');
    });

    require('./menu');
    await flush();

    expect(mockLogging.error).toHaveBeenCalledWith(
      'Unhandled error during menu initialization',
      expect.any(Error),
    );
  });
});
