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
import fetchMock from 'fetch-mock';
import type { contributions, core } from '@apache-superset/core';
import ExtensionsManager from './ExtensionsManager';

// Type-safe mock data generators
interface MockExtensionOptions {
  name?: string;
  description?: string;
  remoteEntry?: string;
  exposedModules?: string[];
  extensionDependencies?: string[];
  commands?: contributions.CommandContribution[];
  menus?: Record<string, contributions.MenuContribution>;
  views?: Record<string, contributions.ViewContribution[]>;
  includeMockFunctions?: boolean;
}

/**
 * Creates a mock extension with proper typing and default values
 */
function createMockExtension(
  options: MockExtensionOptions = {},
): core.Extension {
  const {
    name = 'Test Extension',
    description = 'A test extension',
    remoteEntry = '',
    exposedModules = [],
    extensionDependencies = [],
    commands = [],
    menus = {},
    views = {},
    includeMockFunctions = true,
  } = options;

  const extension: core.Extension = {
    name,
    description,
    remoteEntry,
    exposedModules,
    extensionDependencies,
    contributions: {
      commands,
      menus,
      views,
    },
    activate: includeMockFunctions ? jest.fn() : undefined!,
    deactivate: includeMockFunctions ? jest.fn() : undefined!,
  };

  return extension;
}

/**
 * Creates a mock command contribution with proper typing
 */
function createMockCommand(
  command: string,
  overrides: Partial<contributions.CommandContribution> = {},
): contributions.CommandContribution {
  return {
    command,
    icon: `${command}-icon`,
    title: `${command} Command`,
    description: `A ${command} command`,
    ...overrides,
  };
}

/**
 * Creates a mock menu contribution with proper typing
 */
function createMockMenu(
  overrides: Partial<contributions.MenuContribution> = {},
): contributions.MenuContribution {
  return {
    context: [],
    primary: [],
    secondary: [],
    ...overrides,
  };
}

/**
 * Creates a mock view contribution with proper typing
 */
function createMockView(
  id: string,
  overrides: Partial<contributions.ViewContribution> = {},
): contributions.ViewContribution {
  return {
    id,
    name: `${id} View`,
    ...overrides,
  };
}

/**
 * Creates a mock menu item with proper typing
 */
function createMockMenuItem(
  view: string,
  command: string,
  overrides: Partial<contributions.MenuItem> = {},
): contributions.MenuItem {
  return {
    view,
    command,
    ...overrides,
  };
}

/**
 * Sets up an activated extension in the manager by manually adding context and contributions
 * This simulates what happens when an extension is properly enabled
 */
function setupActivatedExtension(
  manager: ExtensionsManager,
  extension: core.Extension,
  contextOverrides: Partial<{ disposables: { dispose: () => void }[] }> = {},
) {
  const context = { disposables: [], ...contextOverrides };
  (manager as any).contextIndex.set(extension.name, context);
  (manager as any).extensionContributions.set(extension.name, {
    commands: extension.contributions.commands,
    menus: extension.contributions.menus,
    views: extension.contributions.views,
  });
}

/**
 * Creates a fully initialized and activated extension for testing
 */
async function createActivatedExtension(
  manager: ExtensionsManager,
  extensionOptions: MockExtensionOptions = {},
  contextOverrides: Partial<{ disposables: { dispose: () => void }[] }> = {},
): Promise<core.Extension> {
  const mockExtension = createMockExtension({
    ...extensionOptions,
  });

  await manager.initializeExtension(mockExtension);
  setupActivatedExtension(manager, mockExtension, contextOverrides);

  return mockExtension;
}

/**
 * Creates multiple activated extensions for testing
 */
async function createMultipleActivatedExtensions(
  manager: ExtensionsManager,
  extensionConfigs: MockExtensionOptions[],
): Promise<core.Extension[]> {
  const extensionPromises = extensionConfigs.map(config =>
    createActivatedExtension(manager, config),
  );

  return Promise.all(extensionPromises);
}

/**
 * Common assertions for deactivation success
 */
function expectSuccessfulDeactivation(
  result: boolean,
  mockExtension?: core.Extension,
  expectedDeactivateCalls = 1,
) {
  expect(result).toBe(true);
  if (mockExtension && mockExtension.deactivate) {
    expect(mockExtension.deactivate).toHaveBeenCalledTimes(
      expectedDeactivateCalls,
    );
  }
}

/**
 * Common assertions for deactivation failure
 */
function expectFailedDeactivation(result: boolean) {
  expect(result).toBe(false);
}

beforeEach(() => {
  // Clear any existing instance
  (ExtensionsManager as any).instance = undefined;

  // Setup fetch mocks for API calls
  fetchMock.restore();
  fetchMock.put('glob:*/api/v1/extensions/*', { ok: true });
  fetchMock.delete('glob:*/api/v1/extensions/*', { ok: true });
  fetchMock.get('glob:*/api/v1/extensions/', {
    json: { result: [] },
  });
  fetchMock.get('glob:*/api/v1/extensions/*', {
    json: {
      result: createMockExtension({ includeMockFunctions: false }),
    },
  });
});

afterEach(() => {
  // Clean up after each test
  (ExtensionsManager as any).instance = undefined;
  fetchMock.restore();
});

test('creates singleton instance', () => {
  const manager1 = ExtensionsManager.getInstance();
  const manager2 = ExtensionsManager.getInstance();

  expect(manager1).toBe(manager2);
  expect(manager1).toBeInstanceOf(ExtensionsManager);
});

test('singleton maintains state across multiple getInstance calls', async () => {
  const manager1 = ExtensionsManager.getInstance();
  const mockExtension = createMockExtension();

  await manager1.initializeExtension(mockExtension);

  const manager2 = ExtensionsManager.getInstance();
  const extensions = manager2.getExtensions();

  expect(extensions).toHaveLength(1);
  expect(extensions[0]).toEqual(mockExtension);
});

test('returns empty array for getExtensions initially', () => {
  const manager = ExtensionsManager.getInstance();
  const extensions = manager.getExtensions();

  expect(Array.isArray(extensions)).toBe(true);
  expect(extensions).toHaveLength(0);
});
test('returns undefined for non-existent extension', () => {
  const manager = ExtensionsManager.getInstance();
  const extension = manager.getExtension('non-existent-extension');

  expect(extension).toBeUndefined();
});

test('can store and retrieve extensions using initializeExtension', async () => {
  const manager = ExtensionsManager.getInstance();
  const mockExtension = createMockExtension();

  await manager.initializeExtension(mockExtension);

  const extensions = manager.getExtensions();
  expect(extensions).toHaveLength(1);
  expect(extensions[0]).toEqual(mockExtension);

  const retrievedExtension = manager.getExtension('Test Extension');
  expect(retrievedExtension).toEqual(mockExtension);
});

test('handles multiple extensions', async () => {
  const manager = ExtensionsManager.getInstance();

  const extension1 = createMockExtension({
    name: 'Extension 1',
  });

  const extension2 = createMockExtension({
    name: 'Extension 2',
  });

  await manager.initializeExtension(extension1);
  await manager.initializeExtension(extension2);

  const extensions = manager.getExtensions();
  expect(extensions).toHaveLength(2);

  expect(manager.getExtension('Extension 1')).toEqual(extension1);
  expect(manager.getExtension('Extension 2')).toEqual(extension2);

  expect(manager.getExtension('Extension 1')?.name).toBe('Extension 1');
  expect(manager.getExtension('Extension 2')?.name).toBe('Extension 2');
});

test('initializeExtension properly stores extension in manager', async () => {
  const manager = ExtensionsManager.getInstance();

  const mockExtension = createMockExtension({
    name: 'Test Extension',
    description: 'A test extension for initialization',
  });

  expect(manager.getExtension('Test Extension')).toBeUndefined();
  expect(manager.getExtensions()).toHaveLength(0);

  await manager.initializeExtension(mockExtension);

  expect(manager.getExtension('Test Extension')).toBeDefined();
  expect(manager.getExtensions()).toHaveLength(1);
  expect(manager.getExtension('Test Extension')?.name).toBe('Test Extension');
  expect(manager.getExtension('Test Extension')?.description).toBe(
    'A test extension for initialization',
  );
});

test('initializeExtension handles extension without remoteEntry', async () => {
  const manager = ExtensionsManager.getInstance();

  const mockExtension = createMockExtension({
    name: 'Simple Extension',
    description: 'Extension without remote entry',
    remoteEntry: '',
    commands: [createMockCommand('simple.command')],
  });

  expect(manager.getExtension('Simple Extension')).toBeUndefined();

  await manager.initializeExtension(mockExtension);

  expect(manager.getExtension('Simple Extension')).toBeDefined();
  expect(manager.getExtensions()).toHaveLength(1);
  expect(manager.getExtension('Simple Extension')?.name).toBe(
    'Simple Extension',
  );

  // Since extension has no remoteEntry, activate should not be called
  expect(mockExtension.activate).not.toHaveBeenCalled();
});

test('getMenuContributions returns undefined initially', () => {
  const manager = ExtensionsManager.getInstance();
  const menuContributions = manager.getMenuContributions('nonexistent');

  expect(menuContributions).toBeUndefined();
});

test('getViewContributions returns undefined initially', () => {
  const manager = ExtensionsManager.getInstance();
  const viewContributions = manager.getViewContributions('nonexistent');

  expect(viewContributions).toBeUndefined();
});

test('getCommandContributions returns empty array initially', () => {
  const manager = ExtensionsManager.getInstance();
  const commandContributions = manager.getCommandContributions();

  expect(Array.isArray(commandContributions)).toBe(true);
  expect(commandContributions).toHaveLength(0);
});

test('getCommandContribution returns undefined for non-existent command', () => {
  const manager = ExtensionsManager.getInstance();
  const command = manager.getCommandContribution('nonexistent.command');

  expect(command).toBeUndefined();
});

test('deactivateExtension successfully deactivates an enabled extension', async () => {
  const manager = ExtensionsManager.getInstance();
  const mockExtension = await createActivatedExtension(manager, {
    commands: [createMockCommand('test.command')],
  });

  // Verify extension has contributions after setup
  expect(manager.getCommandContributions()).toHaveLength(1);

  // Deactivate the extension
  const result = manager.deactivateExtension('Test Extension');

  expectSuccessfulDeactivation(result, mockExtension);
});

test('deactivateExtension disposes of context disposables', async () => {
  const manager = ExtensionsManager.getInstance();
  const mockDisposable = { dispose: jest.fn() };

  await createActivatedExtension(
    manager,
    {},
    {
      disposables: [mockDisposable],
    },
  );

  // Verify disposable is not yet disposed
  expect(mockDisposable.dispose).not.toHaveBeenCalled();

  // Deactivate the extension
  const result = manager.deactivateExtension('Test Extension');

  expectSuccessfulDeactivation(result);
  expect(mockDisposable.dispose).toHaveBeenCalledTimes(1);
});

test('deactivateExtension handles extension without deactivate function', async () => {
  const manager = ExtensionsManager.getInstance();
  await createActivatedExtension(manager, {
    includeMockFunctions: false, // Don't create mock functions
  });

  // Deactivate should still return true even without deactivate function
  const result = manager.deactivateExtension('Test Extension');

  expectSuccessfulDeactivation(result);
});

test('deactivateExtension returns false for non-existent extension', () => {
  const manager = ExtensionsManager.getInstance();

  const result = manager.deactivateExtension('non-existent-extension');

  expectFailedDeactivation(result);
});

test('deactivateExtension returns false for extension without context', async () => {
  const manager = ExtensionsManager.getInstance();
  const mockExtension = createMockExtension({
    // Extension without context created
  });

  await manager.initializeExtension(mockExtension);

  const result = manager.deactivateExtension('Test Extension');

  expectFailedDeactivation(result);
});

test('deactivateExtension handles errors during deactivation gracefully', async () => {
  const manager = ExtensionsManager.getInstance();
  const mockExtension = await createActivatedExtension(manager);

  // Override the deactivate function to throw an error
  mockExtension.deactivate = jest.fn(() => {
    throw new Error('Deactivation error');
  });

  // Should return false when deactivation throws an error
  const result = manager.deactivateExtension('Test Extension');

  expectFailedDeactivation(result);
  expect(mockExtension.deactivate).toHaveBeenCalledTimes(1);
});

test('deactivateExtension handles errors during dispose gracefully', async () => {
  const manager = ExtensionsManager.getInstance();
  const mockDisposable = {
    dispose: jest.fn(() => {
      throw new Error('Dispose error');
    }),
  };

  await createActivatedExtension(
    manager,
    {},
    {
      disposables: [mockDisposable],
    },
  );

  // Should return false when disposal throws an error
  const result = manager.deactivateExtension('Test Extension');

  expectFailedDeactivation(result);
  expect(mockDisposable.dispose).toHaveBeenCalledTimes(1);
});

test('handles contributions with menu items', async () => {
  const manager = ExtensionsManager.getInstance();

  await createActivatedExtension(manager, {
    commands: [
      createMockCommand('ext1.command1'),
      createMockCommand('ext1.command2'),
    ],
    menus: {
      testMenu: createMockMenu({
        primary: [
          createMockMenuItem('test-view', 'ext1.command1'),
          createMockMenuItem('test-view2', 'ext1.command2'),
        ],
        secondary: [createMockMenuItem('test-view3', 'ext1.command1')],
      }),
    },
    views: {
      testView: [createMockView('test-view-1'), createMockView('test-view-2')],
    },
  });

  // Test command contributions
  const commands = manager.getCommandContributions();
  expect(commands).toHaveLength(2);
  expect(commands.find(cmd => cmd.command === 'ext1.command1')).toBeDefined();
  expect(commands.find(cmd => cmd.command === 'ext1.command2')).toBeDefined();

  // Test menu contributions
  const menuContributions = manager.getMenuContributions('testMenu');
  expect(menuContributions).toBeDefined();
  expect(menuContributions?.primary).toHaveLength(2);
  expect(menuContributions?.secondary).toHaveLength(1);

  // Test view contributions
  const viewContributions = manager.getViewContributions('testView');
  expect(viewContributions).toBeDefined();
  expect(viewContributions).toHaveLength(2);
});

test('handles non-existent menu and view contributions', () => {
  const manager = ExtensionsManager.getInstance();

  expect(manager.getMenuContributions('nonexistent')).toBeUndefined();
  expect(manager.getViewContributions('nonexistent')).toBeUndefined();
  expect(manager.getCommandContribution('nonexistent.command')).toBeUndefined();
});

test('merges contributions from multiple extensions', async () => {
  const manager = ExtensionsManager.getInstance();

  await createMultipleActivatedExtensions(manager, [
    {
      name: 'Extension 1',
      commands: [createMockCommand('ext1.command')],
    },
    {
      name: 'Extension 2',
      commands: [createMockCommand('ext2.command')],
    },
  ]);

  const commands = manager.getCommandContributions();
  expect(commands).toHaveLength(2);

  expect(manager.getCommandContribution('ext1.command')).toBeDefined();
  expect(manager.getCommandContribution('ext2.command')).toBeDefined();
});
