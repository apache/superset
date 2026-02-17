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
import type { editors, contributions } from '@apache-superset/core';
import EditorProviders from './EditorProviders';

type EditorLanguage = contributions.EditorLanguage;
type EditorContribution = editors.EditorContribution;
type EditorComponent = editors.EditorComponent;

/**
 * Creates a mock editor contribution for testing.
 */
function createMockEditorContribution(
  overrides: Partial<EditorContribution> = {},
): EditorContribution {
  return {
    id: 'test.mock-editor',
    name: 'Mock Editor',
    languages: ['sql'] as EditorLanguage[],
    description: 'A mock editor for testing',
    ...overrides,
  };
}

/**
 * Creates a mock editor component for testing.
 */
function createMockEditorComponent(): EditorComponent {
  return jest.fn(() => null) as unknown as EditorComponent;
}

beforeEach(() => {
  // Reset the singleton instance before each test
  const manager = EditorProviders.getInstance();
  manager.reset();
});

test('creates singleton instance', () => {
  const manager1 = EditorProviders.getInstance();
  const manager2 = EditorProviders.getInstance();

  expect(manager1).toBe(manager2);
  expect(manager1).toBeInstanceOf(EditorProviders);
});

test('registers and retrieves a provider', () => {
  const manager = EditorProviders.getInstance();
  const contribution = createMockEditorContribution();
  const component = createMockEditorComponent();

  manager.registerProvider(contribution, component);

  const provider = manager.getProvider('sql');
  expect(provider).toBeDefined();
  expect(provider?.contribution).toEqual(contribution);
  expect(provider?.component).toBe(component);
});

test('hasProvider returns true when provider is registered', () => {
  const manager = EditorProviders.getInstance();
  const contribution = createMockEditorContribution();
  const component = createMockEditorComponent();

  expect(manager.hasProvider('sql')).toBe(false);

  manager.registerProvider(contribution, component);

  expect(manager.hasProvider('sql')).toBe(true);
});

test('hasProvider returns false for unregistered languages', () => {
  const manager = EditorProviders.getInstance();
  const contribution = createMockEditorContribution({
    languages: ['sql'],
  });
  const component = createMockEditorComponent();

  manager.registerProvider(contribution, component);

  expect(manager.hasProvider('sql')).toBe(true);
  expect(manager.hasProvider('json')).toBe(false);
  expect(manager.hasProvider('markdown')).toBe(false);
});

test('returns undefined for unregistered language', () => {
  const manager = EditorProviders.getInstance();

  const provider = manager.getProvider('sql');
  expect(provider).toBeUndefined();
});

test('getAllProviders returns all registered providers', () => {
  const manager = EditorProviders.getInstance();

  expect(manager.getAllProviders()).toHaveLength(0);

  const contribution1 = createMockEditorContribution({
    id: 'editor-1',
    languages: ['sql'],
  });
  const contribution2 = createMockEditorContribution({
    id: 'editor-2',
    languages: ['json'],
  });

  manager.registerProvider(contribution1, createMockEditorComponent());
  manager.registerProvider(contribution2, createMockEditorComponent());

  const providers = manager.getAllProviders();
  expect(providers).toHaveLength(2);
});

test('unregisters provider when disposable is disposed', () => {
  const manager = EditorProviders.getInstance();
  const contribution = createMockEditorContribution();
  const component = createMockEditorComponent();

  const disposable = manager.registerProvider(contribution, component);

  expect(manager.hasProvider('sql')).toBe(true);

  disposable.dispose();

  expect(manager.hasProvider('sql')).toBe(false);
  expect(manager.getProvider('sql')).toBeUndefined();
});

test('supports multiple languages per provider', () => {
  const manager = EditorProviders.getInstance();
  const contribution = createMockEditorContribution({
    languages: ['sql', 'json', 'yaml'],
  });
  const component = createMockEditorComponent();

  manager.registerProvider(contribution, component);

  expect(manager.hasProvider('sql')).toBe(true);
  expect(manager.hasProvider('json')).toBe(true);
  expect(manager.hasProvider('yaml')).toBe(true);
  expect(manager.hasProvider('markdown')).toBe(false);

  // All should return the same provider
  const sqlProvider = manager.getProvider('sql');
  const jsonProvider = manager.getProvider('json');
  const yamlProvider = manager.getProvider('yaml');

  expect(sqlProvider).toBe(jsonProvider);
  expect(jsonProvider).toBe(yamlProvider);
});

test('warns when registering duplicate provider id', () => {
  const manager = EditorProviders.getInstance();
  const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

  const contribution = createMockEditorContribution({
    id: 'duplicate-editor',
  });

  manager.registerProvider(contribution, createMockEditorComponent());

  // Try to register with same ID
  const disposable = manager.registerProvider(
    { ...contribution },
    createMockEditorComponent(),
  );

  expect(consoleWarnSpy).toHaveBeenCalledWith(
    'Editor provider with id "duplicate-editor" is already registered.',
  );

  // Disposing the duplicate should be a no-op
  disposable.dispose();

  // Original provider should still be registered
  expect(manager.hasProvider('sql')).toBe(true);

  consoleWarnSpy.mockRestore();
});

test('fires onDidRegister event when provider is registered', () => {
  const manager = EditorProviders.getInstance();
  const listener = jest.fn();

  manager.onDidRegister(listener);

  const contribution = createMockEditorContribution();
  const component = createMockEditorComponent();

  manager.registerProvider(contribution, component);

  expect(listener).toHaveBeenCalledTimes(1);
  expect(listener).toHaveBeenCalledWith({
    provider: {
      contribution,
      component,
    },
  });
});

test('fires onDidUnregister event when provider is unregistered', () => {
  const manager = EditorProviders.getInstance();
  const listener = jest.fn();

  manager.onDidUnregister(listener);

  const contribution = createMockEditorContribution();
  const disposable = manager.registerProvider(
    contribution,
    createMockEditorComponent(),
  );

  disposable.dispose();

  expect(listener).toHaveBeenCalledTimes(1);
  expect(listener).toHaveBeenCalledWith({
    contribution,
  });
});

test('event listeners can be disposed', () => {
  const manager = EditorProviders.getInstance();
  const listener = jest.fn();

  const listenerDisposable = manager.onDidRegister(listener);

  // Register first provider - listener should be called
  manager.registerProvider(
    createMockEditorContribution({ id: 'editor-1' }),
    createMockEditorComponent(),
  );

  expect(listener).toHaveBeenCalledTimes(1);

  // Dispose the listener
  listenerDisposable.dispose();

  // Register second provider - listener should not be called
  manager.registerProvider(
    createMockEditorContribution({ id: 'editor-2', languages: ['json'] }),
    createMockEditorComponent(),
  );

  expect(listener).toHaveBeenCalledTimes(1); // Still only 1 call
});

test('handles errors in event listeners gracefully', () => {
  const manager = EditorProviders.getInstance();
  const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

  const errorListener = jest.fn(() => {
    throw new Error('Listener error');
  });
  const successListener = jest.fn();

  manager.onDidRegister(errorListener);
  manager.onDidRegister(successListener);

  manager.registerProvider(
    createMockEditorContribution(),
    createMockEditorComponent(),
  );

  // Both listeners should have been called
  expect(errorListener).toHaveBeenCalledTimes(1);
  expect(successListener).toHaveBeenCalledTimes(1);

  // Error should have been logged
  expect(consoleErrorSpy).toHaveBeenCalledWith(
    'Error in event listener:',
    expect.any(Error),
  );

  consoleErrorSpy.mockRestore();
});

test('reset clears all providers and language mappings', () => {
  const manager = EditorProviders.getInstance();

  manager.registerProvider(
    createMockEditorContribution({ id: 'editor-1', languages: ['sql'] }),
    createMockEditorComponent(),
  );
  manager.registerProvider(
    createMockEditorContribution({ id: 'editor-2', languages: ['json'] }),
    createMockEditorComponent(),
  );

  expect(manager.getAllProviders()).toHaveLength(2);
  expect(manager.hasProvider('sql')).toBe(true);
  expect(manager.hasProvider('json')).toBe(true);

  manager.reset();

  expect(manager.getAllProviders()).toHaveLength(0);
  expect(manager.hasProvider('sql')).toBe(false);
  expect(manager.hasProvider('json')).toBe(false);
});

test('later registration replaces language mapping', () => {
  const manager = EditorProviders.getInstance();

  const contribution1 = createMockEditorContribution({
    id: 'editor-1',
    name: 'Editor 1',
    languages: ['sql'],
  });
  const contribution2 = createMockEditorContribution({
    id: 'editor-2',
    name: 'Editor 2',
    languages: ['sql'],
  });

  manager.registerProvider(contribution1, createMockEditorComponent());
  manager.registerProvider(contribution2, createMockEditorComponent());

  // The second registration should replace the first for the 'sql' language
  const provider = manager.getProvider('sql');
  expect(provider?.contribution.id).toBe('editor-2');
  expect(provider?.contribution.name).toBe('Editor 2');

  // But both providers should exist
  expect(manager.getAllProviders()).toHaveLength(2);
});
