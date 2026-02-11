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
import { ReactElement } from 'react';
import { render, screen } from 'spec/helpers/testing-library';
import type { contributions, core } from '@apache-superset/core';
import ExtensionsManager from 'src/extensions/ExtensionsManager';
import { ExtensionsProvider } from 'src/extensions/ExtensionsContext';
import ViewListExtension from '.';

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

function createMockExtension(
  options: Partial<core.Extension> & {
    views?: Record<string, Record<string, contributions.ViewContribution[]>>;
  } = {},
): core.Extension {
  const {
    id = 'test-extension',
    name = 'Test Extension',
    views = {},
  } = options;

  return {
    id,
    name,
    description: 'A test extension',
    version: '1.0.0',
    dependencies: [],
    remoteEntry: '',
    exposedModules: [],
    extensionDependencies: [],
    contributions: {
      commands: [],
      menus: {},
      views,
    },
    activate: jest.fn(),
    deactivate: jest.fn(),
  };
}

function setupActivatedExtension(
  manager: ExtensionsManager,
  extension: core.Extension,
) {
  const context = { disposables: [] };
  (manager as any).contextIndex.set(extension.id, context);
  (manager as any).extensionContributions.set(extension.id, {
    commands: extension.contributions.commands,
    menus: extension.contributions.menus,
    views: extension.contributions.views,
  });
}

async function createActivatedExtension(
  manager: ExtensionsManager,
  extensionOptions: Parameters<typeof createMockExtension>[0] = {},
): Promise<core.Extension> {
  const mockExtension = createMockExtension(extensionOptions);
  await manager.initializeExtension(mockExtension);
  setupActivatedExtension(manager, mockExtension);
  return mockExtension;
}

const TEST_VIEW_ID = 'test.view';

const renderWithExtensionsProvider = (ui: ReactElement) =>
  render(ui, { wrapper: ExtensionsProvider as any });

beforeEach(() => {
  (ExtensionsManager as any).instance = undefined;
});

afterEach(() => {
  (ExtensionsManager as any).instance = undefined;
});

test('renders nothing when no view contributions exist', () => {
  const { container } = renderWithExtensionsProvider(
    <ViewListExtension viewId={TEST_VIEW_ID} />,
  );

  expect(container.firstChild?.childNodes.length ?? 0).toBe(0);
});

test('renders placeholder for unregistered view provider', async () => {
  const manager = ExtensionsManager.getInstance();

  await createActivatedExtension(manager, {
    views: {
      test: {
        view: [createMockView('test-view-1')],
      },
    },
  });

  renderWithExtensionsProvider(<ViewListExtension viewId={TEST_VIEW_ID} />);

  expect(screen.getByText(/test-view-1/)).toBeInTheDocument();
});

test('renders multiple view placeholders for multiple contributions', async () => {
  const manager = ExtensionsManager.getInstance();

  await createActivatedExtension(manager, {
    views: {
      test: {
        view: [createMockView('test-view-1'), createMockView('test-view-2')],
      },
    },
  });

  renderWithExtensionsProvider(<ViewListExtension viewId={TEST_VIEW_ID} />);

  expect(screen.getByText(/test-view-1/)).toBeInTheDocument();
  expect(screen.getByText(/test-view-2/)).toBeInTheDocument();
});

test('renders nothing for viewId with no matching contributions', () => {
  const { container } = renderWithExtensionsProvider(
    <ViewListExtension viewId="nonexistent.view" />,
  );

  expect(container.firstChild?.childNodes.length ?? 0).toBe(0);
});

test('handles multiple extensions with views for same viewId', async () => {
  const manager = ExtensionsManager.getInstance();

  await createActivatedExtension(manager, {
    id: 'extension-1',
    views: {
      test: {
        view: [createMockView('ext1-view')],
      },
    },
  });

  await createActivatedExtension(manager, {
    id: 'extension-2',
    views: {
      test: {
        view: [createMockView('ext2-view')],
      },
    },
  });

  renderWithExtensionsProvider(<ViewListExtension viewId={TEST_VIEW_ID} />);

  expect(screen.getByText(/ext1-view/)).toBeInTheDocument();
  expect(screen.getByText(/ext2-view/)).toBeInTheDocument();
});

test('renders views for different viewIds independently', async () => {
  const manager = ExtensionsManager.getInstance();
  const VIEW_ID_A = 'view.a';
  const VIEW_ID_B = 'view.b';

  await createActivatedExtension(manager, {
    views: {
      view: {
        a: [createMockView('view-a-component')],
        b: [createMockView('view-b-component')],
      },
    },
  });

  const { rerender } = renderWithExtensionsProvider(
    <ViewListExtension viewId={VIEW_ID_A} />,
  );

  expect(screen.getByText(/view-a-component/)).toBeInTheDocument();
  expect(screen.queryByText(/view-b-component/)).not.toBeInTheDocument();

  rerender(<ViewListExtension viewId={VIEW_ID_B} />);

  expect(screen.getByText(/view-b-component/)).toBeInTheDocument();
  expect(screen.queryByText(/view-a-component/)).not.toBeInTheDocument();
});
