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
import type { dashboards } from '@apache-superset/core';
import DashboardRendererProviders from './DashboardRendererProviders';

type DashboardRenderer = dashboards.DashboardRenderer;
type DashboardRendererComponent = dashboards.DashboardRendererComponent;

/**
 * Creates a mock renderer descriptor for testing.
 */
function createMockRenderer(
  overrides: Partial<DashboardRenderer> = {},
): DashboardRenderer {
  return {
    id: 'test.mock-renderer',
    name: 'Mock Renderer',
    description: 'A mock dashboard renderer for testing',
    ...overrides,
  };
}

/**
 * Creates a mock renderer component for testing.
 */
function createMockRendererComponent(): DashboardRendererComponent {
  return jest.fn(() => null) as unknown as DashboardRendererComponent;
}

beforeEach(() => {
  // Reset the singleton instance before each test, including the default
  // tier — this suite exercises the registry in isolation.
  const manager = DashboardRendererProviders.getInstance();
  manager.reset(true);
});

test('creates singleton instance', () => {
  const manager1 = DashboardRendererProviders.getInstance();
  const manager2 = DashboardRendererProviders.getInstance();

  expect(manager1).toBe(manager2);
  expect(manager1).toBeInstanceOf(DashboardRendererProviders);
});

test('registers and retrieves a provider', () => {
  const manager = DashboardRendererProviders.getInstance();
  const renderer = createMockRenderer();
  const component = createMockRendererComponent();

  manager.registerProvider(renderer, component);

  const provider = manager.getProvider();
  expect(provider).toBeDefined();
  expect(provider?.renderer).toEqual(renderer);
  expect(provider?.component).toBe(component);
});

test('returns undefined when no provider is registered', () => {
  const manager = DashboardRendererProviders.getInstance();

  expect(manager.getProvider()).toBeUndefined();
});

test('unregisters provider when disposable is disposed', () => {
  const manager = DashboardRendererProviders.getInstance();
  const renderer = createMockRenderer();

  const disposable = manager.registerProvider(
    renderer,
    createMockRendererComponent(),
  );

  expect(manager.getProvider()).toBeDefined();

  disposable.dispose();

  expect(manager.getProvider()).toBeUndefined();
});

test('most recent registration wins and displaces the previous provider', () => {
  const manager = DashboardRendererProviders.getInstance();
  const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
  const unregisterListener = jest.fn();
  manager.onDidUnregister(unregisterListener);

  const renderer1 = createMockRenderer({ id: 'renderer-1' });
  const renderer2 = createMockRenderer({ id: 'renderer-2' });

  manager.registerProvider(renderer1, createMockRendererComponent());
  manager.registerProvider(renderer2, createMockRendererComponent());

  expect(consoleWarnSpy).toHaveBeenCalledWith(
    'Multiple dashboard renderers registered. Using "renderer-2"; ' +
      'discarding "renderer-1".',
  );
  expect(unregisterListener).toHaveBeenCalledWith({ renderer: renderer1 });
  expect(manager.getProvider()?.renderer.id).toBe('renderer-2');

  consoleWarnSpy.mockRestore();
});

test('disposing a displaced provider is a no-op', () => {
  const manager = DashboardRendererProviders.getInstance();
  const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

  const renderer1 = createMockRenderer({ id: 'renderer-1' });
  const renderer2 = createMockRenderer({ id: 'renderer-2' });

  const disposable1 = manager.registerProvider(
    renderer1,
    createMockRendererComponent(),
  );
  manager.registerProvider(renderer2, createMockRendererComponent());

  // Disposing the displaced provider must not clear the active one
  disposable1.dispose();

  expect(manager.getProvider()?.renderer.id).toBe('renderer-2');

  consoleWarnSpy.mockRestore();
});

test('fires onDidRegister event when provider is registered', () => {
  const manager = DashboardRendererProviders.getInstance();
  const listener = jest.fn();

  manager.onDidRegister(listener);

  const renderer = createMockRenderer();
  manager.registerProvider(renderer, createMockRendererComponent());

  expect(listener).toHaveBeenCalledTimes(1);
  expect(listener).toHaveBeenCalledWith({ renderer });
});

test('fires onDidUnregister event when provider is unregistered', () => {
  const manager = DashboardRendererProviders.getInstance();
  const listener = jest.fn();

  manager.onDidUnregister(listener);

  const renderer = createMockRenderer();
  const disposable = manager.registerProvider(
    renderer,
    createMockRendererComponent(),
  );

  disposable.dispose();

  expect(listener).toHaveBeenCalledTimes(1);
  expect(listener).toHaveBeenCalledWith({ renderer });
});

test('event listeners can be disposed', () => {
  const manager = DashboardRendererProviders.getInstance();
  const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
  const listener = jest.fn();

  const listenerDisposable = manager.onDidRegister(listener);

  manager.registerProvider(
    createMockRenderer({ id: 'renderer-1' }),
    createMockRendererComponent(),
  );

  expect(listener).toHaveBeenCalledTimes(1);

  listenerDisposable.dispose();

  manager.registerProvider(
    createMockRenderer({ id: 'renderer-2' }),
    createMockRendererComponent(),
  );

  expect(listener).toHaveBeenCalledTimes(1); // Still only 1 call

  consoleWarnSpy.mockRestore();
});

test('notifies subscribe listeners on register and unregister', () => {
  const manager = DashboardRendererProviders.getInstance();
  const listener = jest.fn();

  const unsubscribe = manager.subscribe(listener);

  const disposable = manager.registerProvider(
    createMockRenderer(),
    createMockRendererComponent(),
  );
  expect(listener).toHaveBeenCalledTimes(1);

  disposable.dispose();
  expect(listener).toHaveBeenCalledTimes(2);

  unsubscribe();
  manager.registerProvider(createMockRenderer(), createMockRendererComponent());
  expect(listener).toHaveBeenCalledTimes(2); // No further calls
});

test('reset clears the provider slot', () => {
  const manager = DashboardRendererProviders.getInstance();

  manager.registerProvider(createMockRenderer(), createMockRendererComponent());
  expect(manager.getProvider()).toBeDefined();

  manager.reset();

  expect(manager.getOverrideProvider()).toBeUndefined();
});

test('the default provider is active when no override is registered', () => {
  const manager = DashboardRendererProviders.getInstance();
  const defaultRenderer = createMockRenderer({ id: 'host.default' });
  const component = createMockRendererComponent();

  manager.setDefaultProvider(defaultRenderer, component);

  expect(manager.getProvider()?.renderer.id).toBe('host.default');
  expect(manager.getDefaultProvider()?.renderer.id).toBe('host.default');
  expect(manager.getOverrideProvider()).toBeUndefined();
});

test('an override wins over the default without displacing it', () => {
  const manager = DashboardRendererProviders.getInstance();
  const unregisterListener = jest.fn();
  manager.onDidUnregister(unregisterListener);

  manager.setDefaultProvider(
    createMockRenderer({ id: 'host.default' }),
    createMockRendererComponent(),
  );
  manager.registerProvider(
    createMockRenderer({ id: 'ext.override' }),
    createMockRendererComponent(),
  );

  expect(manager.getProvider()?.renderer.id).toBe('ext.override');
  expect(manager.getDefaultProvider()?.renderer.id).toBe('host.default');
  // Registering over the default must not fire an unregister for it
  expect(unregisterListener).not.toHaveBeenCalled();
});

test('disposing the override falls back to the default provider', () => {
  const manager = DashboardRendererProviders.getInstance();

  manager.setDefaultProvider(
    createMockRenderer({ id: 'host.default' }),
    createMockRendererComponent(),
  );
  const disposable = manager.registerProvider(
    createMockRenderer({ id: 'ext.override' }),
    createMockRendererComponent(),
  );

  disposable.dispose();

  expect(manager.getProvider()?.renderer.id).toBe('host.default');
  expect(manager.getOverrideProvider()).toBeUndefined();
});

test('setDefaultProvider is idempotent by renderer id', () => {
  const manager = DashboardRendererProviders.getInstance();
  const listener = jest.fn();
  manager.subscribe(listener);

  const renderer = createMockRenderer({ id: 'host.default' });
  manager.setDefaultProvider(renderer, createMockRendererComponent());
  expect(listener).toHaveBeenCalledTimes(1);

  // Re-registering the same id (e.g. duplicate side-effect import) is a no-op
  manager.setDefaultProvider(renderer, createMockRendererComponent());
  expect(listener).toHaveBeenCalledTimes(1);
});

test('reset keeps the default provider', () => {
  const manager = DashboardRendererProviders.getInstance();

  manager.setDefaultProvider(
    createMockRenderer({ id: 'host.default' }),
    createMockRendererComponent(),
  );
  manager.registerProvider(
    createMockRenderer({ id: 'ext.override' }),
    createMockRendererComponent(),
  );

  manager.reset();

  expect(manager.getOverrideProvider()).toBeUndefined();
  expect(manager.getProvider()?.renderer.id).toBe('host.default');
});
