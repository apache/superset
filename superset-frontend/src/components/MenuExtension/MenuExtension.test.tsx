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
import { render, screen, waitFor } from 'spec/helpers/testing-library';
import userEvent from '@testing-library/user-event';
import type { contributions, core } from '@apache-superset/core';
import ExtensionsManager from 'src/extensions/ExtensionsManager';
import { commands } from 'src/core';
import MenuExtension from 'src/components/MenuExtension';

jest.mock('src/core', () => ({
  commands: {
    executeCommand: jest.fn(),
  },
}));

function createMockCommand(
  command: string,
  overrides: Partial<contributions.CommandContribution> = {},
): contributions.CommandContribution {
  return {
    command,
    icon: 'PlusOutlined',
    title: `${command} Title`,
    description: `${command} description`,
    ...overrides,
  };
}

function createMockMenuItem(
  view: string,
  command: string,
): contributions.MenuItem {
  return {
    view,
    command,
  };
}

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

function createMockExtension(
  options: Partial<core.Extension> & {
    commands?: contributions.CommandContribution[];
    menus?: Record<string, contributions.MenuContribution>;
  } = {},
): core.Extension {
  const {
    id = 'test-extension',
    name = 'Test Extension',
    commands: cmds = [],
    menus = {},
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
      commands: cmds,
      menus,
      views: {},
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

const TEST_VIEW_ID = 'test.menu';

beforeEach(() => {
  (ExtensionsManager as any).instance = undefined;
  jest.clearAllMocks();
});

afterEach(() => {
  (ExtensionsManager as any).instance = undefined;
});

test('renders children when primary mode with no extensions', () => {
  render(
    <MenuExtension viewId={TEST_VIEW_ID} primary>
      <button type="button">Child Button</button>
    </MenuExtension>,
  );

  expect(
    screen.getByRole('button', { name: 'Child Button' }),
  ).toBeInTheDocument();
});

test('renders primary actions from extension contributions', async () => {
  const manager = ExtensionsManager.getInstance();

  await createActivatedExtension(manager, {
    commands: [createMockCommand('test.action')],
    menus: {
      [TEST_VIEW_ID]: createMockMenu({
        primary: [createMockMenuItem('test-view', 'test.action')],
      }),
    },
  });

  render(<MenuExtension viewId={TEST_VIEW_ID} primary />);

  expect(screen.getByText('test.action Title')).toBeInTheDocument();
});

test('renders primary actions with children', async () => {
  const manager = ExtensionsManager.getInstance();

  await createActivatedExtension(manager, {
    commands: [createMockCommand('test.action')],
    menus: {
      [TEST_VIEW_ID]: createMockMenu({
        primary: [createMockMenuItem('test-view', 'test.action')],
      }),
    },
  });

  render(
    <MenuExtension viewId={TEST_VIEW_ID} primary>
      <button type="button">Child Button</button>
    </MenuExtension>,
  );

  expect(screen.getByText('test.action Title')).toBeInTheDocument();
  expect(
    screen.getByRole('button', { name: 'Child Button' }),
  ).toBeInTheDocument();
});

test('hides title in compact mode for primary actions', async () => {
  const manager = ExtensionsManager.getInstance();

  await createActivatedExtension(manager, {
    commands: [createMockCommand('test.action')],
    menus: {
      [TEST_VIEW_ID]: createMockMenu({
        primary: [createMockMenuItem('test-view', 'test.action')],
      }),
    },
  });

  render(<MenuExtension viewId={TEST_VIEW_ID} primary compactMode />);

  expect(screen.queryByText('test.action Title')).not.toBeInTheDocument();
  expect(screen.getByRole('button')).toBeInTheDocument();
});

test('executes command when primary action button is clicked', async () => {
  const manager = ExtensionsManager.getInstance();

  await createActivatedExtension(manager, {
    commands: [createMockCommand('test.action')],
    menus: {
      [TEST_VIEW_ID]: createMockMenu({
        primary: [createMockMenuItem('test-view', 'test.action')],
      }),
    },
  });

  render(<MenuExtension viewId={TEST_VIEW_ID} primary />);

  const button = screen.getByText('test.action Title').closest('button')!;
  await userEvent.click(button);

  expect(commands.executeCommand).toHaveBeenCalledWith('test.action');
});

test('returns null when secondary mode with no actions and no defaultItems', () => {
  const { container } = render(
    <MenuExtension viewId={TEST_VIEW_ID} secondary />,
  );

  expect(container).toBeEmptyDOMElement();
});

test('renders dropdown button when secondary mode with defaultItems', () => {
  render(
    <MenuExtension
      viewId={TEST_VIEW_ID}
      secondary
      defaultItems={[{ key: 'item1', label: 'Item 1' }]}
    />,
  );

  expect(screen.getByRole('button')).toBeInTheDocument();
});

test('renders dropdown menu with defaultItems when clicked', async () => {
  render(
    <MenuExtension
      viewId={TEST_VIEW_ID}
      secondary
      defaultItems={[
        { key: 'item1', label: 'Item 1' },
        { key: 'item2', label: 'Item 2' },
      ]}
    />,
  );

  const dropdownButton = screen.getByRole('button');
  await userEvent.click(dropdownButton);

  await waitFor(() => {
    expect(screen.getByText('Item 1')).toBeInTheDocument();
    expect(screen.getByText('Item 2')).toBeInTheDocument();
  });
});

test('renders secondary actions from extension contributions', async () => {
  const manager = ExtensionsManager.getInstance();

  await createActivatedExtension(manager, {
    commands: [createMockCommand('test.secondary')],
    menus: {
      [TEST_VIEW_ID]: createMockMenu({
        secondary: [createMockMenuItem('test-view', 'test.secondary')],
      }),
    },
  });

  render(<MenuExtension viewId={TEST_VIEW_ID} secondary />);

  const dropdownButton = screen.getByRole('button');
  await userEvent.click(dropdownButton);

  await waitFor(() => {
    expect(screen.getByText('test.secondary Title')).toBeInTheDocument();
  });
});

test('merges extension secondary actions with defaultItems', async () => {
  const manager = ExtensionsManager.getInstance();

  await createActivatedExtension(manager, {
    commands: [createMockCommand('test.secondary')],
    menus: {
      [TEST_VIEW_ID]: createMockMenu({
        secondary: [createMockMenuItem('test-view', 'test.secondary')],
      }),
    },
  });

  render(
    <MenuExtension
      viewId={TEST_VIEW_ID}
      secondary
      defaultItems={[{ key: 'default-item', label: 'Default Item' }]}
    />,
  );

  const dropdownButton = screen.getByRole('button');
  await userEvent.click(dropdownButton);

  await waitFor(() => {
    expect(screen.getByText('test.secondary Title')).toBeInTheDocument();
    expect(screen.getByText('Default Item')).toBeInTheDocument();
  });
});

test('executes command when secondary menu item is clicked', async () => {
  const manager = ExtensionsManager.getInstance();

  await createActivatedExtension(manager, {
    commands: [createMockCommand('test.secondary')],
    menus: {
      [TEST_VIEW_ID]: createMockMenu({
        secondary: [createMockMenuItem('test-view', 'test.secondary')],
      }),
    },
  });

  render(<MenuExtension viewId={TEST_VIEW_ID} secondary />);

  const dropdownButton = screen.getByRole('button');
  await userEvent.click(dropdownButton);

  await waitFor(() => {
    expect(screen.getByText('test.secondary Title')).toBeInTheDocument();
  });

  const menuItem = screen.getByText('test.secondary Title');
  await userEvent.click(menuItem);

  expect(commands.executeCommand).toHaveBeenCalledWith('test.secondary');
});

test('renders multiple primary actions from multiple contributions', async () => {
  const manager = ExtensionsManager.getInstance();

  await createActivatedExtension(manager, {
    commands: [
      createMockCommand('test.action1'),
      createMockCommand('test.action2'),
    ],
    menus: {
      [TEST_VIEW_ID]: createMockMenu({
        primary: [
          createMockMenuItem('test-view1', 'test.action1'),
          createMockMenuItem('test-view2', 'test.action2'),
        ],
      }),
    },
  });

  render(<MenuExtension viewId={TEST_VIEW_ID} primary />);

  expect(screen.getByText('test.action1 Title')).toBeInTheDocument();
  expect(screen.getByText('test.action2 Title')).toBeInTheDocument();
});

test('handles viewId with no matching contributions', () => {
  render(
    <MenuExtension viewId="nonexistent.menu" primary>
      <button type="button">Fallback</button>
    </MenuExtension>,
  );

  expect(screen.getByRole('button', { name: 'Fallback' })).toBeInTheDocument();
});
