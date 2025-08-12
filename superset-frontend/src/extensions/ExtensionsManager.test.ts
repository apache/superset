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
  id?: number;
  name?: string;
  description?: string;
  enabled?: boolean;
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
    id = 1,
    name = 'Test Extension',
    description = 'A test extension',
    enabled = false,
    remoteEntry = '',
    exposedModules = [],
    extensionDependencies = [],
    commands = [],
    menus = {},
    views = {},
    includeMockFunctions = true,
  } = options;

  const extension: core.Extension = {
    id,
    name,
    description,
    enabled,
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
  const extension = manager.getExtension(999);

  expect(extension).toBeUndefined();
});

test('can store and retrieve extensions using initializeExtension', async () => {
  const manager = ExtensionsManager.getInstance();
  const mockExtension = createMockExtension();

  await manager.initializeExtension(mockExtension);

  const extensions = manager.getExtensions();
  expect(extensions).toHaveLength(1);
  expect(extensions[0]).toEqual(mockExtension);

  const retrievedExtension = manager.getExtension(1);
  expect(retrievedExtension).toEqual(mockExtension);
});

test('handles multiple extensions', async () => {
  const manager = ExtensionsManager.getInstance();

  const extension1 = createMockExtension({
    id: 1,
    name: 'Extension 1',
  });

  const extension2 = createMockExtension({
    id: 2,
    name: 'Extension 2',
  });

  await manager.initializeExtension(extension1);
  await manager.initializeExtension(extension2);

  const extensions = manager.getExtensions();
  expect(extensions).toHaveLength(2);

  expect(manager.getExtension(1)).toEqual(extension1);
  expect(manager.getExtension(2)).toEqual(extension2);

  expect(manager.getExtension(1)?.name).toBe('Extension 1');
  expect(manager.getExtension(2)?.name).toBe('Extension 2');
});

test('initializeExtension properly stores extension in manager', async () => {
  const manager = ExtensionsManager.getInstance();

  const mockExtension = createMockExtension({
    name: 'Test Extension',
    description: 'A test extension for initialization',
    enabled: true,
  });

  expect(manager.getExtension(1)).toBeUndefined();
  expect(manager.getExtensions()).toHaveLength(0);

  await manager.initializeExtension(mockExtension);

  expect(manager.getExtension(1)).toBeDefined();
  expect(manager.getExtensions()).toHaveLength(1);
  expect(manager.getExtension(1)?.name).toBe('Test Extension');
  expect(manager.getExtension(1)?.description).toBe(
    'A test extension for initialization',
  );
});

test('initializeExtension handles extension without remoteEntry', async () => {
  const manager = ExtensionsManager.getInstance();

  const mockExtension = createMockExtension({
    name: 'Simple Extension',
    description: 'Extension without remote entry',
    enabled: false,
    remoteEntry: '',
    commands: [createMockCommand('simple.command')],
  });

  expect(manager.getExtension(1)).toBeUndefined();

  await manager.initializeExtension(mockExtension);

  expect(manager.getExtension(1)).toBeDefined();
  expect(manager.getExtensions()).toHaveLength(1);
  expect(manager.getExtension(1)?.name).toBe('Simple Extension');

  // Since extension is not enabled, activate should not be called
  expect(mockExtension.activate).not.toHaveBeenCalled();
});

test('enableExtension calls activate function and tracks context', async () => {
  const manager = ExtensionsManager.getInstance();
  const mockExtension = createMockExtension({
    commands: [createMockCommand('test.command')],
  });

  await manager.initializeExtension(mockExtension);
  await manager.enableExtension(mockExtension);

  expect(mockExtension.activate).toHaveBeenCalledTimes(1);
  expect(manager.getCommandContributions()).toHaveLength(1);
  expect(manager.getCommandContribution('test.command')).toBeDefined();
});

test('enableExtension does not call activate twice for same extension', async () => {
  const manager = ExtensionsManager.getInstance();
  const mockExtension = createMockExtension({
    commands: [createMockCommand('test.command')],
  });

  await manager.initializeExtension(mockExtension);

  await manager.enableExtension(mockExtension);
  await manager.enableExtension(mockExtension);

  expect(mockExtension.activate).toHaveBeenCalledTimes(1);
  expect(manager.getCommandContributions()).toHaveLength(1);
});

test('enableExtensionById enables extension by its ID', async () => {
  const manager = ExtensionsManager.getInstance();

  const mockExtension = createMockExtension({
    enabled: false,
    commands: [createMockCommand('test.command')],
  });

  await manager.initializeExtension(mockExtension);

  expect(mockExtension.activate).not.toHaveBeenCalled();
  expect(manager.getCommandContributions()).toHaveLength(0);

  fetchMock.restore();
  fetchMock.put('glob:*/api/v1/extensions/1', { ok: true });

  await manager.enableExtensionById(1);

  expect(mockExtension.activate).toHaveBeenCalledTimes(1);
  expect(manager.getCommandContributions()).toHaveLength(1);
  expect(manager.getCommandContribution('test.command')).toBeDefined();
});

test('enableExtensionById handles non-existent extension gracefully', async () => {
  const manager = ExtensionsManager.getInstance();

  await expect(manager.enableExtensionById(999)).resolves.toBeUndefined();
});

test('disableExtensionById calls deactivate function', async () => {
  const manager = ExtensionsManager.getInstance();
  const mockExtension = createMockExtension({ enabled: true });

  await manager.initializeExtension(mockExtension);
  await manager.enableExtension(mockExtension);

  expect(mockExtension.activate).toHaveBeenCalledTimes(1);

  await manager.disableExtensionById(1);

  expect(mockExtension.deactivate).toHaveBeenCalledTimes(1);

  const retrievedExtension = manager.getExtension(1);
  expect(retrievedExtension).toBeDefined();
  expect(retrievedExtension?.enabled).toBe(false);
});

test('disableExtensionById removes contributions', async () => {
  const manager = ExtensionsManager.getInstance();

  const mockExtension = createMockExtension({
    enabled: true,
    commands: [createMockCommand('test.command')],
    menus: {
      testMenu: createMockMenu({
        primary: [createMockMenuItem('test-view', 'test.command')],
      }),
    },
    views: {
      testView: [createMockView('test-view')],
    },
  });

  await manager.initializeExtension(mockExtension);
  await manager.enableExtension(mockExtension);

  expect(manager.getMenuContributions('testMenu')).toBeDefined();
  expect(manager.getViewContributions('testView')).toBeDefined();
  expect(manager.getCommandContributions()).toHaveLength(1);

  await manager.disableExtensionById(1);

  expect(manager.getMenuContributions('testMenu')).toBeUndefined();
  expect(manager.getViewContributions('testView')).toBeUndefined();
  expect(manager.getCommandContributions()).toHaveLength(0);
});

test('disableExtensionById handles non-existent extension gracefully', async () => {
  const manager = ExtensionsManager.getInstance();

  await expect(manager.disableExtensionById(999)).resolves.toBeUndefined();
});

test('removeExtensionsByIds removes extensions completely', async () => {
  const manager = ExtensionsManager.getInstance();

  const extension1 = createMockExtension({
    id: 1,
    name: 'Extension 1',
    commands: [createMockCommand('ext1.command')],
  });

  const extension2 = createMockExtension({
    id: 2,
    name: 'Extension 2',
    commands: [createMockCommand('ext2.command')],
  });

  await manager.initializeExtension(extension1);
  await manager.enableExtension(extension1);
  await manager.initializeExtension(extension2);
  await manager.enableExtension(extension2);

  expect(manager.getExtensions()).toHaveLength(2);
  expect(manager.getCommandContributions()).toHaveLength(2);

  await manager.removeExtensionsByIds([1]);

  expect(manager.getExtensions()).toHaveLength(1);
  expect(manager.getExtension(1)).toBeUndefined();
  expect(manager.getExtension(2)).toBeDefined();

  expect(extension1.deactivate).toHaveBeenCalledTimes(1);
  expect(extension2.deactivate).not.toHaveBeenCalled();

  expect(manager.getCommandContributions()).toHaveLength(1);
  expect(manager.getCommandContribution('ext1.command')).toBeUndefined();
  expect(manager.getCommandContribution('ext2.command')).toBeDefined();
});

test('removeExtensionsByIds can remove multiple extensions', async () => {
  const manager = ExtensionsManager.getInstance();

  const extension1 = createMockExtension({
    id: 1,
    name: 'Extension 1',
  });

  const extension2 = createMockExtension({
    id: 2,
    name: 'Extension 2',
  });

  await manager.initializeExtension(extension1);
  await manager.initializeExtension(extension2);

  expect(manager.getExtensions()).toHaveLength(2);

  await manager.removeExtensionsByIds([1, 2]);

  expect(manager.getExtensions()).toHaveLength(0);
  expect(manager.getExtension(1)).toBeUndefined();
  expect(manager.getExtension(2)).toBeUndefined();
});

test('removeExtensionsByIds handles non-existent extensions gracefully', async () => {
  const manager = ExtensionsManager.getInstance();

  await expect(
    manager.removeExtensionsByIds([999, 1000]),
  ).resolves.toBeUndefined();
});

test('extension lifecycle: initialize -> enable -> disable -> remove', async () => {
  const manager = ExtensionsManager.getInstance();

  const mockExtension = createMockExtension({
    name: 'Lifecycle Test Extension',
    description: 'Extension for testing lifecycle',
    commands: [createMockCommand('lifecycle.command')],
  });

  // 1. Initialize
  await manager.initializeExtension(mockExtension);
  expect(manager.getExtensions()).toHaveLength(1);
  expect(manager.getExtension(1)).toBeDefined();

  // 2. Enable
  await manager.enableExtension(mockExtension);
  expect(mockExtension.activate).toHaveBeenCalledTimes(1);
  expect(manager.getCommandContributions()).toHaveLength(1);

  // 3. Disable
  await manager.disableExtensionById(1);
  expect(mockExtension.deactivate).toHaveBeenCalledTimes(1);
  expect(manager.getExtension(1)?.enabled).toBe(false);
  expect(manager.getCommandContributions()).toHaveLength(0);

  // 4. Remove
  await manager.removeExtensionsByIds([1]);
  expect(manager.getExtensions()).toHaveLength(0);
  expect(manager.getExtension(1)).toBeUndefined();

  // deactivate should have been called only once (during disable)
  // removeExtensionsByIds won't call deactivate again since context was already cleaned up
  expect(mockExtension.deactivate).toHaveBeenCalledTimes(1);
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

test('handles contributions with menu items', async () => {
  const manager = ExtensionsManager.getInstance();

  const mockExtension = createMockExtension({
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

  await manager.initializeExtension(mockExtension);
  await manager.enableExtension(mockExtension);

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

  const extension1 = createMockExtension({
    id: 1,
    name: 'Extension 1',
    commands: [createMockCommand('ext1.command')],
  });

  const extension2 = createMockExtension({
    id: 2,
    name: 'Extension 2',
    commands: [createMockCommand('ext2.command')],
  });

  await manager.initializeExtension(extension1);
  await manager.enableExtension(extension1);
  await manager.initializeExtension(extension2);
  await manager.enableExtension(extension2);

  const commands = manager.getCommandContributions();
  expect(commands).toHaveLength(2);

  expect(manager.getCommandContribution('ext1.command')).toBeDefined();
  expect(manager.getCommandContribution('ext2.command')).toBeDefined();
});
