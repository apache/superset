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

function createMockExtension(overrides: Partial<Extension> = {}): Extension {
  return {
    id: 'test-extension',
    name: 'Test Extension',
    description: 'A test extension',
    version: '1.0.0',
    dependencies: [],
    remoteEntry: '',
    extensionDependencies: [],
    ...overrides,
  };
}

beforeEach(() => {
  (ExtensionsLoader as any).instance = undefined;
  // Minimal host registry surface the loader wraps during module evaluation.
  (window as any).superset = {
    commands: { registerCommand: jest.fn() },
    menus: { registerMenuItem: jest.fn() },
    editors: { registerEditor: jest.fn() },
    views: { registerView: jest.fn() },
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

/**
 * Stubs the module-federation machinery `loadModule` depends on so a fake
 * extension entry module (its `./index` factory) can be loaded in jsdom.
 * Returns a cleanup function that restores the patched globals.
 */
function mockRemoteModule(containerName: string, factory: () => unknown) {
  const appendChildSpy = jest
    .spyOn(document.head, 'appendChild')
    .mockImplementation((element: Node) => {
      if (element instanceof HTMLScriptElement && element.onload) {
        setTimeout(() => (element.onload as any)(new Event('load')), 0);
      }
      return element;
    });

  (global as any).__webpack_init_sharing__ = jest
    .fn()
    .mockResolvedValue(undefined);
  (global as any).__webpack_share_scopes__ = { default: {} };
  (window as any)[containerName] = {
    init: jest.fn().mockResolvedValue(undefined),
    get: jest.fn().mockResolvedValue(factory),
  };

  return () => {
    appendChildSpy.mockRestore();
    delete (global as any).__webpack_init_sharing__;
    delete (global as any).__webpack_share_scopes__;
    delete (window as any)[containerName];
  };
}

const remoteExtension = (overrides: Partial<Extension> = {}) =>
  createMockExtension({
    id: 'remote-ext',
    remoteEntry: 'http://example/remoteEntry.js',
    ...overrides,
  });

test('disposes synchronous activation-time registrations on deactivation', async () => {
  const loader = ExtensionsLoader.getInstance();
  const dispose = jest.fn();
  // Legacy side-effect style: register synchronously during module evaluation.
  const factory = () => {
    window.superset.views.registerView(
      { id: 'remote-ext.view', name: 'View' },
      'sqllab.panels',
      (() => null) as any,
    );
    return undefined;
  };
  const registerView = jest
    .spyOn(window.superset.views, 'registerView')
    .mockReturnValue({ dispose } as any);
  const cleanup = mockRemoteModule('remote-ext', factory);

  await loader.initializeExtension(remoteExtension());
  loader.deactivateExtension('remote-ext');

  expect(dispose).toHaveBeenCalledTimes(1);

  registerView.mockRestore();
  cleanup();
});

test('tracks registrations made asynchronously inside activate(context)', async () => {
  const loader = ExtensionsLoader.getInstance();
  const dispose = jest.fn();
  const registerView = jest
    .spyOn(window.superset.views, 'registerView')
    .mockReturnValue({ dispose } as any);

  // Modern style: register AFTER an await — the window.superset wrap is already
  // gone by then, so this is only tracked because activate pushes to context.
  const factory = () => ({
    activate: async (context: core.ExtensionContext) => {
      await Promise.resolve();
      const disposable = window.superset.views.registerView(
        { id: 'remote-ext.async-view', name: 'Async View' },
        'sqllab.panels',
        (() => null) as any,
      );
      context.subscriptions.push(disposable);
    },
  });
  const cleanup = mockRemoteModule('remote-ext', factory);

  await loader.initializeExtension(remoteExtension());
  loader.deactivateExtension('remote-ext');

  expect(registerView).toHaveBeenCalledTimes(1);
  expect(dispose).toHaveBeenCalledTimes(1);

  registerView.mockRestore();
  cleanup();
});
