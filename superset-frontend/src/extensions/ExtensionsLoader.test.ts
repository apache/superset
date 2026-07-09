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
import { SupersetClient } from '@superset-ui/core';
import { logging } from '@apache-superset/core/utils';
import type { common as core } from '@apache-superset/core';
import ExtensionsLoader from './ExtensionsLoader';

type Extension = core.Extension;

const mockApplicationRoot = jest.fn<string, []>(() => '');

jest.mock('src/utils/getBootstrapData', () => {
  const actual = jest.requireActual<
    typeof import('src/utils/getBootstrapData')
  >('src/utils/getBootstrapData');
  return {
    __esModule: true,
    ...actual,
    applicationRoot: () => mockApplicationRoot(),
  };
});

function createMockExtension(overrides: Partial<Extension> = {}): Extension {
  return {
    id: 'test-extension',
    name: 'Test Extension',
    description: 'A test extension',
    version: '1.0.0',
    dependencies: [],
    remoteEntry: '',
    ...overrides,
  };
}

beforeEach(() => {
  (ExtensionsLoader as any).instance = undefined;
  mockApplicationRoot.mockReturnValue('');
});

/**
 * Capture the src attribute of the remote-entry script element and trigger
 * its onerror handler so loadModule short-circuits without webpack module
 * federation globals.
 */
function captureRemoteEntryScript(): {
  getSrc: () => string | null;
  restore: () => void;
} {
  let capturedSrc: string | null = null;
  const appendChildSpy = jest
    .spyOn(document.head, 'appendChild')
    .mockImplementation((element: Node) => {
      if (element instanceof HTMLScriptElement) {
        capturedSrc = element.getAttribute('src');
        if (element.onerror) {
          const errorHandler = element.onerror;
          setTimeout(() => {
            errorHandler('Script load halted by test');
          }, 0);
        }
      }
      return element;
    });
  return {
    getSrc: () => capturedSrc,
    restore: () => appendChildSpy.mockRestore(),
  };
}

test('creates a singleton instance', () => {
  const instance1 = ExtensionsLoader.getInstance();
  const instance2 = ExtensionsLoader.getInstance();
  expect(instance1).toBe(instance2);
});

test('returns empty array when no extensions registered', () => {
  const loader = ExtensionsLoader.getInstance();
  expect(loader.getExtensions()).toEqual([]);
});

test('stores extension after initialization', async () => {
  const loader = ExtensionsLoader.getInstance();
  const ext = createMockExtension({ id: 'my-ext' });
  await loader.initializeExtension(ext);
  expect(loader.getExtension('my-ext')).toEqual(ext);
});

test('returns undefined for non-existent extension', () => {
  const loader = ExtensionsLoader.getInstance();
  expect(loader.getExtension('nonexistent')).toBeUndefined();
});

test('stores multiple extensions', async () => {
  const loader = ExtensionsLoader.getInstance();
  await loader.initializeExtension(createMockExtension({ id: 'ext-1' }));
  await loader.initializeExtension(createMockExtension({ id: 'ext-2' }));
  expect(loader.getExtensions()).toHaveLength(2);
  expect(loader.getExtension('ext-1')).toBeDefined();
  expect(loader.getExtension('ext-2')).toBeDefined();
});

test('initializes extension without remoteEntry', async () => {
  const loader = ExtensionsLoader.getInstance();
  const ext = createMockExtension({ id: 'local-ext', remoteEntry: '' });
  await loader.initializeExtension(ext);
  expect(loader.getExtension('local-ext')).toEqual(ext);
});

test('handles initialization errors gracefully', async () => {
  const loader = ExtensionsLoader.getInstance();
  const errorSpy = jest.spyOn(logging, 'error').mockImplementation();

  // Intercept script element creation so onerror fires in jsdom
  const appendChildSpy = jest
    .spyOn(document.head, 'appendChild')
    .mockImplementation((element: Node) => {
      if (element instanceof HTMLScriptElement && element.onerror) {
        setTimeout(() => {
          (element.onerror as any)('Script load error');
        }, 0);
      }
      return element;
    });

  const ext = createMockExtension({
    id: 'broken-ext',
    remoteEntry: 'http://broken-url/remoteEntry.js',
  });

  await loader.initializeExtension(ext);

  expect(errorSpy).toHaveBeenCalledWith(
    expect.stringContaining('Failed to initialize extension'),
    expect.anything(),
  );
  // Extension should not be stored on failure
  expect(loader.getExtension('broken-ext')).toBeUndefined();

  errorSpy.mockRestore();
  appendChildSpy.mockRestore();
});

test('logs success after initializeExtensions completes', async () => {
  const loader = ExtensionsLoader.getInstance();
  const infoSpy = jest.spyOn(logging, 'info').mockImplementation();
  jest.spyOn(SupersetClient, 'get').mockResolvedValue({
    json: { result: [] },
  } as any);

  await loader.initializeExtensions();

  expect(infoSpy).toHaveBeenCalledWith('Extensions initialized successfully.');

  infoSpy.mockRestore();
});

// Subdirectory regression (gap review 2026-06-10): the backend emits a
// router-relative remoteEntry URL; assigning it raw to `script.src` resolved
// it against the domain root, 404ing every extension under a subdirectory
// deployment.
test('prefixes a router-relative remoteEntry with the application root', async () => {
  mockApplicationRoot.mockReturnValue('/superset');
  const loader = ExtensionsLoader.getInstance();
  const errorSpy = jest.spyOn(logging, 'error').mockImplementation();
  const script = captureRemoteEntryScript();

  await loader.initializeExtension(
    createMockExtension({
      id: 'sub-ext',
      remoteEntry: '/api/v1/extensions/pub/sub-ext/remoteEntry.js',
    }),
  );

  expect(script.getSrc()).toBe(
    '/superset/api/v1/extensions/pub/sub-ext/remoteEntry.js',
  );

  errorSpy.mockRestore();
  script.restore();
});

test('leaves the remoteEntry unprefixed on root deployments', async () => {
  const loader = ExtensionsLoader.getInstance();
  const errorSpy = jest.spyOn(logging, 'error').mockImplementation();
  const script = captureRemoteEntryScript();

  await loader.initializeExtension(
    createMockExtension({
      id: 'root-ext',
      remoteEntry: '/api/v1/extensions/pub/root-ext/remoteEntry.js',
    }),
  );

  expect(script.getSrc()).toBe(
    '/api/v1/extensions/pub/root-ext/remoteEntry.js',
  );

  errorSpy.mockRestore();
  script.restore();
});

test('passes an absolute remoteEntry URL through unchanged', async () => {
  mockApplicationRoot.mockReturnValue('/superset');
  const loader = ExtensionsLoader.getInstance();
  const errorSpy = jest.spyOn(logging, 'error').mockImplementation();
  const script = captureRemoteEntryScript();

  await loader.initializeExtension(
    createMockExtension({
      id: 'cdn-ext',
      remoteEntry: 'https://cdn.example.com/remoteEntry.js',
    }),
  );

  expect(script.getSrc()).toBe('https://cdn.example.com/remoteEntry.js');

  errorSpy.mockRestore();
  script.restore();
});

test('logs error when initializeExtensions fails', async () => {
  const loader = ExtensionsLoader.getInstance();
  const errorSpy = jest.spyOn(logging, 'error').mockImplementation();
  const fetchError = new Error('Network error');
  jest.spyOn(SupersetClient, 'get').mockRejectedValue(fetchError);

  await loader.initializeExtensions();

  expect(errorSpy).toHaveBeenCalledWith(
    'Error setting up extensions:',
    fetchError,
  );

  errorSpy.mockRestore();
});
