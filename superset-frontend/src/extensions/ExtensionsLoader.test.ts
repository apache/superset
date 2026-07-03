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
import ExtensionsLoader, { LoadedExtension } from './ExtensionsLoader';

function createMockExtension(
  overrides: Partial<LoadedExtension> = {},
): LoadedExtension {
  return {
    id: 'test-extension',
    name: 'Test Extension',
    description: 'A test extension',
    version: '1.0.0',
    dependencies: [],
    extensionDependencies: [],
    remoteEntry: '',
    ...overrides,
  };
}

// Simulate what real webpack does when __webpack_init_sharing__ runs: it
// registers the host's own eagerly-provided @apache-superset/core versions
// into the share scope.
function mockWebpackSharing(coreVersions: Record<string, unknown> = {}) {
  (globalThis as any).__webpack_init_sharing__ = jest
    .fn()
    .mockImplementation(() => {
      (globalThis as any).__webpack_share_scopes__.default[
        '@apache-superset/core'
      ] = coreVersions;
    });
  (globalThis as any).__webpack_share_scopes__ = { default: {} };
}

function cleanupWebpackSharing() {
  delete (globalThis as any).__webpack_init_sharing__;
  delete (globalThis as any).__webpack_share_scopes__;
}

// Intercept script element creation so onload fires synchronously in jsdom.
function mockRemoteEntryLoad() {
  return jest
    .spyOn(document.head, 'appendChild')
    .mockImplementation((el: Node) => {
      if (el instanceof HTMLScriptElement && el.onload) {
        (el as HTMLScriptElement).onload!(new Event('load'));
      }
      return el;
    });
}

beforeEach(() => {
  (ExtensionsLoader as any).instance = undefined;
  // Reset window.superset to a base object before each test, including a
  // shared singleton (commands) to verify identity is preserved across
  // per-extension scoped copies.
  (window as any).superset = {
    commands: { registerCommand: jest.fn() },
    extensions: {
      getContext: () => {
        throw new Error('No extension context');
      },
      getExtension: () => undefined,
      getAllExtensions: () => [],
    },
  };
});

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

test('logs partial failure count when some extensions fail to initialize', async () => {
  const loader = ExtensionsLoader.getInstance();
  const infoSpy = jest.spyOn(logging, 'info').mockImplementation();
  jest.spyOn(SupersetClient, 'get').mockResolvedValue({
    json: {
      result: [
        createMockExtension({ id: 'good-ext', remoteEntry: '' }),
        createMockExtension({
          id: 'broken-ext',
          remoteEntry: 'http://broken-url/remoteEntry.js',
        }),
      ],
    },
  } as any);
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

  await loader.initializeExtensions();

  expect(infoSpy).toHaveBeenCalledWith(
    expect.stringContaining('1 of 2 extension(s) failing'),
  );
  expect(loader.getExtension('good-ext')).toBeDefined();
  expect(loader.getExtension('broken-ext')).toBeUndefined();

  infoSpy.mockRestore();
  appendChildSpy.mockRestore();
});

test('each extension gets an isolated getContext via module federation custom scope', async () => {
  const loader = ExtensionsLoader.getInstance();

  // Capture the scoped @apache-superset/core instance each container receives
  const capturedCoreModules: Array<any> = [];

  const makeContainer = () => ({
    init: jest.fn().mockImplementation(async (scope: any) => {
      // Simulate what a real container does: resolve the module from the scope
      const moduleFactory = await scope['@apache-superset/core']['0.1.0'].get();
      capturedCoreModules.push(moduleFactory());
    }),
    get: jest.fn().mockResolvedValue(() => {}),
  });

  const appendChildSpy = mockRemoteEntryLoad();

  // Simulate what real webpack does when __webpack_init_sharing__ runs:
  // it registers the host's own eagerly-provided @apache-superset/core
  // into the share scope under its resolved version key.
  mockWebpackSharing({
    '0.1.0': {
      get: () => Promise.resolve(() => ({})),
      loaded: true,
      eager: true,
    },
  });

  const ext1 = createMockExtension({
    id: 'org.ext1',
    remoteEntry: 'http://ext1/remoteEntry.js',
  });
  const ext2 = createMockExtension({
    id: 'org.ext2',
    remoteEntry: 'http://ext2/remoteEntry.js',
  });

  (window as any).airbnb_ext1 = makeContainer();
  (window as any).airbnb_ext2 = makeContainer();

  await Promise.all([
    loader.initializeExtension({
      ...ext1,
      moduleFederationName: 'airbnb_ext1',
    }),
    loader.initializeExtension({
      ...ext2,
      moduleFederationName: 'airbnb_ext2',
    }),
  ]);

  expect(capturedCoreModules).toHaveLength(2);
  // Each container received a different @apache-superset/core instance
  expect(capturedCoreModules[0]).not.toBe(capturedCoreModules[1]);
  // Each instance has getContext bound to the right extension
  expect(capturedCoreModules[0].extensions.getContext().extension.id).toBe(
    'org.ext1',
  );
  expect(capturedCoreModules[1].extensions.getContext().extension.id).toBe(
    'org.ext2',
  );
  // Shared APIs are the same underlying objects
  expect(capturedCoreModules[0].commands).toBe(capturedCoreModules[1].commands);

  appendChildSpy.mockRestore();
  cleanupWebpackSharing();
});

test('throws when the container is missing from window', async () => {
  const loader = ExtensionsLoader.getInstance();
  const errorSpy = jest.spyOn(logging, 'error').mockImplementation();
  const appendChildSpy = mockRemoteEntryLoad();
  mockWebpackSharing({
    '0.1.0': { get: () => Promise.resolve(() => ({})) },
  });

  const ext = createMockExtension({
    id: 'missing-container-ext',
    remoteEntry: 'http://ext/remoteEntry.js',
    moduleFederationName: 'nonexistent_container',
  });

  const succeeded = await loader.initializeExtension(ext);

  expect(succeeded).toBe(false);
  expect(errorSpy).toHaveBeenCalledWith(
    expect.stringContaining('Failed to initialize extension'),
    expect.objectContaining({
      message: expect.stringContaining(
        'Extension container "nonexistent_container" was not found',
      ),
    }),
  );

  errorSpy.mockRestore();
  appendChildSpy.mockRestore();
  cleanupWebpackSharing();
});

test('throws when the container does not expose init/get', async () => {
  const loader = ExtensionsLoader.getInstance();
  const errorSpy = jest.spyOn(logging, 'error').mockImplementation();
  const appendChildSpy = mockRemoteEntryLoad();
  mockWebpackSharing({
    '0.1.0': { get: () => Promise.resolve(() => ({})) },
  });

  (window as any).malformed_container = { init: jest.fn() }; // missing `get`

  const ext = createMockExtension({
    id: 'malformed-container-ext',
    remoteEntry: 'http://ext/remoteEntry.js',
    moduleFederationName: 'malformed_container',
  });

  const succeeded = await loader.initializeExtension(ext);

  expect(succeeded).toBe(false);
  expect(errorSpy).toHaveBeenCalledWith(
    expect.stringContaining('Failed to initialize extension'),
    expect.objectContaining({
      message: expect.stringContaining(
        'does not expose the expected Module Federation runtime',
      ),
    }),
  );

  errorSpy.mockRestore();
  appendChildSpy.mockRestore();
  delete (window as any).malformed_container;
  cleanupWebpackSharing();
});

test('throws when the host @apache-superset/core version cannot be resolved', async () => {
  const loader = ExtensionsLoader.getInstance();
  const errorSpy = jest.spyOn(logging, 'error').mockImplementation();
  const appendChildSpy = mockRemoteEntryLoad();
  // No '@apache-superset/core' entry gets registered in the share scope.
  mockWebpackSharing();

  (window as any).unresolved_version_container = {
    init: jest.fn(),
    get: jest.fn().mockResolvedValue(() => {}),
  };

  const ext = createMockExtension({
    id: 'unresolved-version-ext',
    remoteEntry: 'http://ext/remoteEntry.js',
    moduleFederationName: 'unresolved_version_container',
  });

  const succeeded = await loader.initializeExtension(ext);

  expect(succeeded).toBe(false);
  expect(errorSpy).toHaveBeenCalledWith(
    expect.stringContaining('Failed to initialize extension'),
    expect.objectContaining({
      message: expect.stringContaining(
        "Could not resolve the host's @apache-superset/core version",
      ),
    }),
  );

  errorSpy.mockRestore();
  appendChildSpy.mockRestore();
  delete (window as any).unresolved_version_container;
  cleanupWebpackSharing();
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
