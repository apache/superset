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
import {
  act,
  fireEvent,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import fetchMock from 'fetch-mock';
import userEvent from '@testing-library/user-event';
import { isFeatureEnabled, FeatureFlag } from '@superset-ui/core';
import {
  setupMocks,
  setupApiPermissions,
  renderDatasetList,
  mockAdminUser,
  mockReadOnlyUser,
  mockWriteUser,
  mockExportOnlyUser,
  mockDatasets,
  mockDatasetListEndpoints,
} from './DatasetList.testHelpers';

jest.mock('@superset-ui/core', () => ({
  ...jest.requireActual('@superset-ui/core'),
  isFeatureEnabled: jest.fn(),
}));

// Increase default timeout for tests that involve multiple async operations
// CI parallel load can cause timeouts with default 15s
jest.setTimeout(30000);

beforeEach(() => {
  jest.useRealTimers();
  setupMocks();
  jest.clearAllMocks();
});

afterEach(async () => {
  // Flush pending React state updates within act() to prevent warnings
  await act(async () => {
    await new Promise(resolve => setTimeout(resolve, 0));
  });

  // Restore real timers in case a test threw early
  jest.useRealTimers();

  // Reset browser history to prevent query param leakage
  window.history.replaceState({}, '', '/');

  fetchMock.clearHistory();
  fetchMock.removeRoutes();
  jest.restoreAllMocks();
});

test('admin users see all UI elements', async () => {
  // Setup API with full admin permissions
  setupApiPermissions(['can_read', 'can_write', 'can_export', 'can_duplicate']);

  renderDatasetList(mockAdminUser);

  expect(await screen.findByText('Datasets')).toBeInTheDocument();

  // Admin should see create button
  expect(
    screen.getByRole('button', { name: /(?:plus\s*)?Dataset$/i }),
  ).toBeInTheDocument();

  // Admin should see import button
  // Note: Using testId - import button lacks accessible text content
  // TODO: Add aria-label or text to import button
  expect(screen.getByTestId('import-button')).toBeInTheDocument();

  // Admin should see bulk select button
  expect(
    screen.getByRole('button', { name: /bulk select/i }),
  ).toBeInTheDocument();

  // Admin should see actions column - wait for table first, then check column
  const table = await screen.findByTestId('listview-table');
  await waitFor(() => {
    expect(
      within(table).getByRole('columnheader', { name: /Actions/i }),
    ).toBeInTheDocument();
  });
}, 45000);

test('read-only users cannot see Actions column', async () => {
  // Setup API with read-only permissions
  setupApiPermissions(['can_read']);

  renderDatasetList(mockReadOnlyUser);

  await waitFor(() => {
    expect(screen.getByText('Datasets')).toBeInTheDocument();
  });

  await waitFor(() => {
    const table = screen.getByTestId('listview-table');
    // Actions column should not be present
    expect(within(table).queryByText(/Actions/i)).not.toBeInTheDocument();
  });
});

test.each([
  [true, 'archive'],
  [false, 'delete'],
])(
  'soft delete %s uses the dataset row permission hint for %s',
  async (enabled, verb) => {
    (isFeatureEnabled as jest.Mock).mockImplementation(
      flag => enabled && flag === FeatureFlag.SoftDelete,
    );
    setupApiPermissions(['can_read', 'can_write']);
    renderDatasetList(mockWriteUser);
    const row = (await screen.findByText(mockDatasets[0].table_name)).closest(
      'tr',
    );
    const action = within(row!).getByTestId('dataset-row-delete');
    await act(async () => {
      action.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    });
    expect(await screen.findByRole('tooltip')).toHaveTextContent(
      `You must be a dataset editor in order to ${verb}.`,
    );
  },
);

test('read-only users cannot see bulk select button', async () => {
  // Setup API with read-only permissions
  setupApiPermissions(['can_read']);

  renderDatasetList(mockReadOnlyUser);

  await waitFor(() => {
    expect(screen.getByText('Datasets')).toBeInTheDocument();
  });

  // Bulk select should not be visible
  expect(
    screen.queryByRole('button', { name: /bulk select/i }),
  ).not.toBeInTheDocument();
});

test('read-only users cannot see Create/Import buttons', async () => {
  // Setup API with read-only permissions
  setupApiPermissions(['can_read']);

  renderDatasetList(mockReadOnlyUser);

  await waitFor(() => {
    expect(screen.getByText('Datasets')).toBeInTheDocument();
  });

  // Create button should not be visible
  expect(
    screen.queryByRole('button', { name: /(?:plus\s*)?Dataset$/i }),
  ).not.toBeInTheDocument();

  // Import button should not be visible
  // Note: Using testId - import button lacks accessible text content
  // TODO: Add aria-label or text to import button
  expect(screen.queryByTestId('import-button')).not.toBeInTheDocument();
});

test('write users see Actions column', async () => {
  // Setup API with write permissions
  setupApiPermissions(['can_read', 'can_write', 'can_export']);

  renderDatasetList(mockWriteUser);

  await waitFor(() => {
    expect(screen.getByText('Datasets')).toBeInTheDocument();
  });

  await waitFor(() => {
    const table = screen.getByTestId('listview-table');
    expect(
      within(table).getByRole('columnheader', { name: /Actions/i }),
    ).toBeInTheDocument();
  });
});

test('write users see bulk select button', async () => {
  // Setup API with write permissions
  setupApiPermissions(['can_read', 'can_write', 'can_export']);

  renderDatasetList(mockWriteUser);

  await waitFor(() => {
    expect(screen.getByText('Datasets')).toBeInTheDocument();
  });

  expect(
    screen.getByRole('button', { name: /bulk select/i }),
  ).toBeInTheDocument();
});

test('write users see Create/Import buttons', async () => {
  // Setup API with write permissions
  setupApiPermissions(['can_read', 'can_write', 'can_export']);

  renderDatasetList(mockWriteUser);

  await waitFor(() => {
    expect(screen.getByText('Datasets')).toBeInTheDocument();
  });

  // Create button should be visible
  expect(
    screen.getByRole('button', { name: /(?:plus\s*)?Dataset$/i }),
  ).toBeInTheDocument();

  // Import button should be visible
  // Note: Using testId - import button lacks accessible text content
  // TODO: Add aria-label or text to import button
  expect(screen.getByTestId('import-button')).toBeInTheDocument();
});

test('export-only users see bulk select (for export only)', async () => {
  // Setup API with export-only permissions
  setupApiPermissions(['can_read', 'can_export']);

  renderDatasetList(mockExportOnlyUser);

  await waitFor(() => {
    expect(screen.getByText('Datasets')).toBeInTheDocument();
  });

  // Export users should see bulk select for export functionality
  expect(
    screen.getByRole('button', { name: /bulk select/i }),
  ).toBeInTheDocument();
});

test('export-only users cannot see Create/Import buttons', async () => {
  // Setup API with export-only permissions
  setupApiPermissions(['can_read', 'can_export']);

  renderDatasetList(mockExportOnlyUser);

  await waitFor(() => {
    expect(screen.getByText('Datasets')).toBeInTheDocument();
  });

  // Create and Import should not be visible for export-only users
  expect(
    screen.queryByRole('button', { name: /(?:plus\s*)?Dataset$/i }),
  ).not.toBeInTheDocument();
  // Note: Using testId - import button lacks accessible text content
  // TODO: Add aria-label or text to import button
  expect(screen.queryByTestId('import-button')).not.toBeInTheDocument();
});

test('action buttons respect user permissions', async () => {
  // Setup API with full admin permissions
  setupApiPermissions(['can_read', 'can_write', 'can_export', 'can_duplicate']);

  const dataset = mockDatasets[0];

  mockDatasetListEndpoints({ result: [dataset], count: 1 });

  renderDatasetList(mockAdminUser);

  await waitFor(() => {
    expect(screen.getByText(dataset.table_name)).toBeInTheDocument();
  });

  // Admin should see action buttons in the row
  const row = screen.getByText(dataset.table_name).closest('tr');
  expect(row).toBeInTheDocument();

  // Verify specific action buttons are present
  const deleteButton = within(row!).queryByTestId('delete');
  const exportButton = within(row!).queryByTestId('upload');

  expect(deleteButton).toBeInTheDocument();
  expect(exportButton).toBeInTheDocument();
});

test('read-only user sees no delete or duplicate buttons in row', async () => {
  // Setup API with read-only permissions
  setupApiPermissions(['can_read']);

  const dataset = mockDatasets[0];

  mockDatasetListEndpoints({ result: [dataset], count: 1 });

  renderDatasetList(mockReadOnlyUser);

  await waitFor(() => {
    expect(screen.getByText(dataset.table_name)).toBeInTheDocument();
  });

  // Find the dataset row
  const row = screen.getByText(dataset.table_name).closest('tr');
  expect(row).toBeInTheDocument();

  // Verify no delete button in the row
  const deleteButton = within(row!).queryByTestId('delete');
  expect(deleteButton).not.toBeInTheDocument();

  // Verify no duplicate button (Actions column should not exist)
  const duplicateButton = within(row!).queryByTestId('copy');
  expect(duplicateButton).not.toBeInTheDocument();

  // Verify no edit button
  const editButton = within(row!).queryByTestId('edit');
  expect(editButton).not.toBeInTheDocument();
});

test('write user sees edit, delete, and export actions', async () => {
  // Setup API with write permissions (includes delete)
  // Note: can_write grants both edit and delete permissions in DatasetList
  setupApiPermissions(['can_read', 'can_write', 'can_export']);

  const dataset = {
    ...mockDatasets[0],
  };

  mockDatasetListEndpoints({ result: [dataset], count: 1 });

  renderDatasetList(mockWriteUser);

  await waitFor(() => {
    expect(screen.getByText(dataset.table_name)).toBeInTheDocument();
  });

  const row = screen.getByText(dataset.table_name).closest('tr');
  expect(row).toBeInTheDocument();

  // Should have delete button (can_write includes delete)
  const deleteButton = within(row!).getByTestId('delete');
  expect(deleteButton).toBeInTheDocument();

  // Should have export button
  const exportButton = within(row!).getByTestId('upload');
  expect(exportButton).toBeInTheDocument();

  // Should have edit button (user is editor)
  const editButton = within(row!).getByTestId('edit');
  expect(editButton).toBeInTheDocument();

  // Should NOT have duplicate button (no can_duplicate permission)
  const duplicateButton = within(row!).queryByTestId('copy');
  expect(duplicateButton).not.toBeInTheDocument();
});

test('export-only user has no Actions column (no write/duplicate permissions)', async () => {
  // Setup API with export-only permissions
  // Note: Export action alone doesn't render Actions column - it's in toolbar/bulk select
  setupApiPermissions(['can_read', 'can_export']);

  const dataset = mockDatasets[0];

  mockDatasetListEndpoints({ result: [dataset], count: 1 });

  renderDatasetList(mockExportOnlyUser);

  await waitFor(() => {
    expect(screen.getByText(dataset.table_name)).toBeInTheDocument();
  });

  const row = screen.getByText(dataset.table_name).closest('tr');
  expect(row).toBeInTheDocument();

  // Actions column is hidden when user only has export permission
  // (export is available via bulk select toolbar, not row actions)
  const deleteButton = within(row!).queryByTestId('delete');
  expect(deleteButton).not.toBeInTheDocument();

  const editButton = within(row!).queryByTestId('edit');
  expect(editButton).not.toBeInTheDocument();

  const duplicateButton = within(row!).queryByTestId('copy');
  expect(duplicateButton).not.toBeInTheDocument();

  const exportButton = within(row!).queryByTestId('upload');
  expect(exportButton).not.toBeInTheDocument();
});

test('user with can_duplicate sees duplicate button only for virtual datasets', async () => {
  // Setup API with duplicate permission
  setupApiPermissions(['can_read', 'can_duplicate']);

  const physicalDataset = mockDatasets[0]; // kind: 'physical'
  const virtualDataset = mockDatasets[1]; // kind: 'virtual'

  mockDatasetListEndpoints({
    result: [physicalDataset, virtualDataset],
    count: 2,
  });

  renderDatasetList(mockAdminUser);

  await waitFor(() => {
    expect(screen.getByText(physicalDataset.table_name)).toBeInTheDocument();
  });

  // Check physical dataset row
  const physicalRow = screen
    .getByText(physicalDataset.table_name)
    .closest('tr');
  expect(physicalRow).toBeInTheDocument();

  // Physical dataset should NOT have duplicate button
  const physicalDuplicateButton = within(physicalRow!).queryByTestId('copy');
  expect(physicalDuplicateButton).not.toBeInTheDocument();

  // Check virtual dataset row
  const virtualRow = screen.getByText(virtualDataset.table_name).closest('tr');
  expect(virtualRow).toBeInTheDocument();

  // Virtual dataset SHOULD have duplicate button
  const virtualDuplicateButton = within(virtualRow!).getByTestId('copy');
  expect(virtualDuplicateButton).toBeInTheDocument();
});

describe('semantic layer setup transition', () => {
  const configure = (canWriteLayer: boolean) => {
    jest
      .mocked(isFeatureEnabled)
      .mockImplementation(flag => flag === 'SEMANTIC_LAYERS');
    setupApiPermissions(['can_read', 'can_write']);
    fetchMock.get(
      'glob:*/api/v1/semantic_layer/',
      { result: [] },
      { name: 'setup-layers' },
    );
    fetchMock.get(
      'glob:*/api/v1/semantic_layer/types',
      { result: [] },
      { name: 'setup-types' },
    );
    return {
      ...mockAdminUser,
      roles: {
        Custom: [
          ['can_read', 'SemanticLayer'],
          ...(canWriteLayer ? [['can_write', 'SemanticLayer']] : []),
        ],
      },
    };
  };

  const openView = async () => {
    await userEvent.click(await screen.findByTestId('btn-create-new'));
    await userEvent.click(
      await screen.findByText('Semantic View', {
        selector: '.ant-dropdown-menu-title-content',
      }),
    );
  };

  test('layer writers can switch dialogs and cancel back to a fresh layer list', async () => {
    renderDatasetList(configure(true));
    await openView();
    await userEvent.click(
      await screen.findByRole('button', { name: 'Create semantic layer' }),
    );
    expect(
      await screen.findByText(
        'No semantic layer types are available. Ask your administrator to check the semantic layer setup for this deployment.',
      ),
    ).toBeInTheDocument();
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
    fireEvent.keyDown(screen.getByRole('dialog'), {
      key: 'Escape',
      keyCode: 27,
    });
    expect(
      await screen.findByRole('button', { name: 'Create semantic layer' }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
    expect(fetchMock.callHistory.calls('setup-layers')).toHaveLength(2);
    expect(
      fetchMock.callHistory
        .calls()
        .filter(call => call.options.method === 'POST'),
    ).toHaveLength(0);
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() =>
      expect(screen.getByTestId('btn-create-new')).toHaveFocus(),
    );
  });

  test('dataset writers without layer-write permission get administrator guidance', async () => {
    renderDatasetList(configure(false));
    await openView();
    expect(
      await screen.findByText(
        /Ask your administrator to set up a semantic layer or grant you access/,
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Create semantic layer' }),
    ).not.toBeInTheDocument();
  });

  test.each([true, false])(
    'creation success=%s returns only after a successful save',
    async succeeds => {
      const user = configure(true);
      fetchMock.removeRoutes({ names: ['setup-types'] });
      fetchMock.get('glob:*/api/v1/semantic_layer/types', {
        result: [{ id: 'example', name: 'Example provider' }],
      });
      fetchMock.post('glob:*/api/v1/semantic_layer/schema/configuration', {
        result: { type: 'object', properties: {} },
      });
      fetchMock.post(
        'glob:*/api/v1/semantic_layer/',
        succeeds ? { result: { uuid: 'new-layer' } } : 500,
        { name: 'create-layer' },
      );
      renderDatasetList(user);
      await openView();
      await userEvent.click(
        await screen.findByRole('button', { name: 'Create semantic layer' }),
      );
      const typePicker = await screen.findByRole('combobox', {
        name: 'Semantic layer type',
      });
      await waitFor(() => expect(typePicker).toBeEnabled());
      fireEvent.mouseDown(typePicker);
      await userEvent.click(
        await screen.findByText('Example provider', {
          selector: '.ant-select-item-option-content',
        }),
      );
      await userEvent.click(screen.getByRole('button', { name: 'Add' }));
      const create = await screen.findByRole('button', { name: 'Create' });
      await waitFor(() => expect(create).toBeEnabled());
      fetchMock.removeRoutes({ names: ['setup-layers'] });
      fetchMock.get(
        'glob:*/api/v1/semantic_layer/',
        { result: [{ uuid: 'new-layer', name: 'Example provider' }] },
        { name: 'refreshed-layers' },
      );
      await userEvent.click(create);
      await waitFor(() =>
        expect(fetchMock.callHistory.calls('create-layer')).toHaveLength(1),
      );
      if (succeeds) {
        expect(
          await screen.findByRole('combobox', { name: 'Semantic layer' }),
        ).toHaveValue('');
        await waitFor(() =>
          expect(fetchMock.callHistory.calls('refreshed-layers')).toHaveLength(
            1,
          ),
        );
        expect(screen.getByRole('button', { name: 'Add' })).toBeDisabled();
      } else {
        await waitFor(() => expect(create).toBeEnabled());
        expect(
          screen.queryByRole('combobox', { name: 'Semantic layer' }),
        ).not.toBeInTheDocument();
        expect(fetchMock.callHistory.calls('refreshed-layers')).toHaveLength(0);
      }
      expect(screen.getAllByRole('dialog')).toHaveLength(1);
      expect(
        fetchMock.callHistory
          .calls()
          .filter(
            call =>
              String(call.url).includes('/semantic_view/') &&
              call.options.method === 'POST',
          ),
      ).toHaveLength(0);
    },
  );

  test('late layer creation cannot replace a newer setup session', async () => {
    const user = configure(true);
    fetchMock.removeRoutes({ names: ['setup-types'] });
    fetchMock.get('glob:*/api/v1/semantic_layer/types', {
      result: [{ id: 'example', name: 'Example provider' }],
    });
    fetchMock.post('glob:*/api/v1/semantic_layer/schema/configuration', {
      result: { type: 'object', properties: {} },
    });
    let finishSave!: (value: { result: { uuid: string } }) => void;
    fetchMock.post(
      'glob:*/api/v1/semantic_layer/',
      () =>
        new Promise(resolve => {
          finishSave = resolve;
        }),
      { name: 'pending-create' },
    );
    renderDatasetList(user);
    await openView();
    await userEvent.click(
      await screen.findByRole('button', { name: 'Create semantic layer' }),
    );
    const typePicker = await screen.findByRole('combobox', {
      name: 'Semantic layer type',
    });
    await waitFor(() => expect(typePicker).toBeEnabled());
    fireEvent.mouseDown(typePicker);
    await userEvent.click(
      await screen.findByText('Example provider', {
        selector: '.ant-select-item-option-content',
      }),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Add' }));
    const create = await screen.findByRole('button', { name: 'Create' });
    await waitFor(() => expect(create).toBeEnabled());
    await userEvent.click(create);
    await waitFor(() =>
      expect(fetchMock.callHistory.calls('pending-create')).toHaveLength(1),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await userEvent.click(
      await screen.findByRole('button', { name: 'Create semantic layer' }),
    );
    expect(
      await screen.findByRole('combobox', { name: 'Semantic layer type' }),
    ).toBeInTheDocument();
    await act(async () => {
      finishSave({ result: { uuid: 'old-layer' } });
      await fetchMock.callHistory.flush(true);
    });
    expect(
      screen.getByRole('combobox', { name: 'Semantic layer type' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('combobox', { name: 'Semantic layer' }),
    ).not.toBeInTheDocument();
    expect(fetchMock.callHistory.calls('setup-layers')).toHaveLength(2);
  });

  test('late layer creation refreshes the view picker after cancel without stale UI', async () => {
    const user = configure(true);
    const addSuccessToast = jest.fn();
    fetchMock.removeRoutes({ names: ['setup-types'] });
    fetchMock.get('glob:*/api/v1/semantic_layer/types', {
      result: [{ id: 'example', name: 'Example provider' }],
    });
    fetchMock.post('glob:*/api/v1/semantic_layer/schema/configuration', {
      result: { type: 'object', properties: {} },
    });
    let finishSave!: (value: { result: { uuid: string } }) => void;
    fetchMock.post(
      'glob:*/api/v1/semantic_layer/',
      () =>
        new Promise(resolve => {
          finishSave = resolve;
        }),
      { name: 'pending-create' },
    );
    renderDatasetList(user, { addSuccessToast });
    await openView();
    await userEvent.click(
      await screen.findByRole('button', { name: 'Create semantic layer' }),
    );
    const typePicker = await screen.findByRole('combobox', {
      name: 'Semantic layer type',
    });
    await waitFor(() => expect(typePicker).toBeEnabled());
    fireEvent.mouseDown(typePicker);
    await userEvent.click(
      await screen.findByText('Example provider', {
        selector: '.ant-select-item-option-content',
      }),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Add' }));
    const create = await screen.findByRole('button', { name: 'Create' });
    await waitFor(() => expect(create).toBeEnabled());
    await userEvent.click(create);
    await waitFor(() =>
      expect(fetchMock.callHistory.calls('pending-create')).toHaveLength(1),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(
      await screen.findByText(/No semantic layers are available to you/),
    ).toBeInTheDocument();
    expect(fetchMock.callHistory.calls('setup-layers')).toHaveLength(2);
    fetchMock.removeRoutes({ names: ['setup-layers'] });
    fetchMock.get(
      'glob:*/api/v1/semantic_layer/',
      { result: [{ uuid: 'new-layer', name: 'Example provider' }] },
      { name: 'refreshed-layers' },
    );
    await act(async () => {
      finishSave({ result: { uuid: 'new-layer' } });
      await fetchMock.callHistory.flush(true);
    });
    await waitFor(() =>
      expect(fetchMock.callHistory.calls('refreshed-layers')).toHaveLength(1),
    );
    const layerPicker = screen.getByRole('combobox', {
      name: 'Semantic layer',
    });
    expect(layerPicker).toBeEnabled();
    fireEvent.mouseDown(layerPicker);
    expect(
      await screen.findByText('Example provider', {
        selector: '.ant-select-item-option-content',
      }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
    expect(addSuccessToast).not.toHaveBeenCalled();
  });

  test('flag off keeps the setup entry unavailable', async () => {
    const user = configure(true);
    jest.mocked(isFeatureEnabled).mockReturnValue(false);
    renderDatasetList(user);
    expect(await screen.findByText('Datasets')).toBeInTheDocument();
    expect(screen.queryByTestId('btn-create-new')).not.toBeInTheDocument();
    expect(fetchMock.callHistory.calls('setup-layers')).toHaveLength(0);
  });
});
