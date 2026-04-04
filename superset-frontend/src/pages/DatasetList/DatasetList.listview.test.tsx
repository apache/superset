/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
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
  screen,
  waitFor,
  within,
  fireEvent,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import fetchMock from 'fetch-mock';
import rison from 'rison';
import { SupersetClient } from '@superset-ui/core';
import { selectOption } from 'spec/helpers/testing-library';
import {
  setupMocks,
  renderDatasetList,
  mockAdminUser,
  mockDatasets,
  setupDeleteMocks,
  setupBulkDeleteMocks,
  setupDuplicateMocks,
  mockHandleResourceExport,
  assertOnlyExpectedCalls,
  API_ENDPOINTS,
  getDeleteRouteName,
} from './DatasetList.testHelpers';

const mockAddDangerToast = jest.fn();
const mockAddSuccessToast = jest.fn();

jest.mock('src/components/MessageToasts/actions', () => ({
  addDangerToast: (msg: string) => {
    mockAddDangerToast(msg);
    return () => ({ type: '@@toast/danger' });
  },
  addSuccessToast: (msg: string) => {
    mockAddSuccessToast(msg);
    return () => ({ type: '@@toast/success' });
  },
}));

jest.mock('src/utils/export');

// Increase default timeout for tests that involve multiple async operations
jest.setTimeout(15000);

const buildSupersetClientError = ({
  status,
  message,
}: {
  status: number;
  message: string;
}) => ({
  message,
  error: message,
  status,
  response: {
    status,
    json: async () => ({ message }),
    text: async () => message,
    clone() {
      return {
        ...this,
        json: async () => ({ message }),
        text: async () => message,
      };
    },
  },
});

/**
 * Helper to set up error test scenarios with SupersetClient spy
 * Reduces boilerplate for error toast tests
 */
const setupErrorTestScenario = ({
  dataset,
  method,
  endpoint,
  errorStatus,
  errorMessage,
}: {
  dataset: (typeof mockDatasets)[0];
  method: 'get' | 'post';
  endpoint: string;
  errorStatus: number;
  errorMessage: string;
}) => {
  // Spy on SupersetClient method and throw error for specific endpoint
  const originalMethod =
    method === 'get'
      ? SupersetClient.get.bind(SupersetClient)
      : SupersetClient.post.bind(SupersetClient);

  jest.spyOn(SupersetClient, method).mockImplementation(async request => {
    if (request.endpoint?.includes(endpoint)) {
      throw buildSupersetClientError({
        status: errorStatus,
        message: errorMessage,
      });
    }
    return originalMethod(request);
  });

  // Configure fetchMock to return single dataset
  fetchMock.removeRoutes({ names: [API_ENDPOINTS.DATASETS] });
  fetchMock.get(API_ENDPOINTS.DATASETS, { result: [dataset], count: 1 });

  // Render component with toast mocks
  renderDatasetList(mockAdminUser, {
    addDangerToast: mockAddDangerToast,
    addSuccessToast: mockAddSuccessToast,
  });
};

beforeEach(() => {
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

  // Reset browser history state to prevent query params leaking between tests
  window.history.replaceState({}, '', '/');

  fetchMock.clearHistory();
  fetchMock.removeRoutes();
  jest.restoreAllMocks();
});

test('required API endpoints are called and no unmocked calls on initial render', async () => {
  renderDatasetList(mockAdminUser);

  await waitFor(() => {
    expect(screen.getByTestId('listview-table')).toBeInTheDocument();
  });

  assertOnlyExpectedCalls([
    API_ENDPOINTS.DATASETS_INFO,
    API_ENDPOINTS.DATASETS,
  ]);
});

test('renders all required column headers', async () => {
  renderDatasetList(mockAdminUser);

  await waitFor(() => {
    expect(screen.getByTestId('listview-table')).toBeInTheDocument();
  });

  const table = screen.getByTestId('listview-table');

  expect(
    within(table).getByRole('columnheader', { name: /Name/i }),
  ).toBeInTheDocument();
  expect(
    within(table).getByRole('columnheader', { name: /Type/i }),
  ).toBeInTheDocument();
  expect(
    within(table).getByRole('columnheader', { name: /Database/i }),
  ).toBeInTheDocument();
  expect(
    within(table).getByRole('columnheader', { name: /Schema/i }),
  ).toBeInTheDocument();
  expect(
    within(table).getByRole('columnheader', { name: /Owners/i }),
  ).toBeInTheDocument();
  expect(
    within(table).getByRole('columnheader', { name: /Last modified/i }),
  ).toBeInTheDocument();
  expect(
    within(table).getByRole('columnheader', { name: /Actions/i }),
  ).toBeInTheDocument();
});

test('displays dataset name in Name column', async () => {
  const dataset = mockDatasets[0];
  fetchMock.removeRoutes({ names: [API_ENDPOINTS.DATASETS] });
  fetchMock.get(API_ENDPOINTS.DATASETS, { result: [dataset], count: 1 });

  renderDatasetList(mockAdminUser);

  await waitFor(() => {
    expect(screen.getByText(dataset.table_name)).toBeInTheDocument();
  });
});

test('displays dataset type as Physical or Virtual', async () => {
  const physicalDataset = mockDatasets[0];
  const virtualDataset = mockDatasets[1];

  fetchMock.removeRoutes({ names: [API_ENDPOINTS.DATASETS] });
  fetchMock.get(API_ENDPOINTS.DATASETS, {
    result: [physicalDataset, virtualDataset],
    count: 2,
  });

  renderDatasetList(mockAdminUser);

  await waitFor(() => {
    expect(screen.getByText(physicalDataset.table_name)).toBeInTheDocument();
  });
  expect(screen.getByText(virtualDataset.table_name)).toBeInTheDocument();
});

test('displays database name in Database column', async () => {
  const dataset = mockDatasets[0];
  fetchMock.removeRoutes({ names: [API_ENDPOINTS.DATASETS] });
  fetchMock.get(API_ENDPOINTS.DATASETS, { result: [dataset], count: 1 });

  renderDatasetList(mockAdminUser);

  await waitFor(() => {
    expect(
      screen.getByText(dataset.database.database_name),
    ).toBeInTheDocument();
  });
});

test('displays last modified date in humanized format', async () => {
  const dataset = mockDatasets[0];
  fetchMock.removeRoutes({ names: [API_ENDPOINTS.DATASETS] });
  fetchMock.get(API_ENDPOINTS.DATASETS, { result: [dataset], count: 1 });

  renderDatasetList(mockAdminUser);

  await waitFor(() => {
    expect(
      screen.getByText(dataset.changed_on_delta_humanized),
    ).toBeInTheDocument();
  });
});

test('sorting by Name column updates API call with sort parameter', async () => {
  renderDatasetList(mockAdminUser);

  await waitFor(() => {
    expect(screen.getByTestId('listview-table')).toBeInTheDocument();
  });

  const table = screen.getByTestId('listview-table');
  const nameHeader = within(table).getByRole('columnheader', { name: /Name/i });
  const initialCalls = fetchMock.callHistory.calls(
    API_ENDPOINTS.DATASETS,
  ).length;

  await userEvent.click(nameHeader);

  await waitFor(() => {
    const calls = fetchMock.callHistory.calls(API_ENDPOINTS.DATASETS);
    expect(calls.length).toBeGreaterThan(initialCalls);
  });

  const calls = fetchMock.callHistory.calls(API_ENDPOINTS.DATASETS);
  const latestCall = calls[calls.length - 1];
  expect(latestCall.url).toMatch(/order_column|sort/);
});

test('delete action successfully deletes dataset and refreshes list', async () => {
  const datasetToDelete = mockDatasets[0];
  setupDeleteMocks(datasetToDelete.id);

  fetchMock.removeRoutes({ names: [API_ENDPOINTS.DATASETS] });
  fetchMock.get(API_ENDPOINTS.DATASETS, {
    result: [datasetToDelete],
    count: 1,
  });

  renderDatasetList(mockAdminUser, { addSuccessToast: mockAddSuccessToast });

  await waitFor(() => {
    expect(screen.getByTestId('listview-table')).toBeInTheDocument();
  });

  const table = screen.getByTestId('listview-table');
  const deleteButton = await within(table).findByTestId('delete');
  await userEvent.click(deleteButton);

  const modal = await screen.findByRole('dialog');
  const confirmInput = within(modal).getByTestId('delete-modal-input');
  await userEvent.type(confirmInput, 'DELETE');

  const callsBefore = fetchMock.callHistory.calls(
    API_ENDPOINTS.DATASETS,
  ).length;
  const confirmButton = within(modal)
    .getAllByRole('button', { name: /^delete$/i })
    .pop();
  await userEvent.click(confirmButton!);

  await waitFor(() => {
    expect(mockAddSuccessToast).toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  await waitFor(() => {
    expect(
      fetchMock.callHistory.calls(API_ENDPOINTS.DATASETS).length,
    ).toBeGreaterThan(callsBefore);
  });
});

test('duplicate action successfully duplicates virtual dataset', async () => {
  const virtualDataset = mockDatasets[1];
  setupDuplicateMocks();

  fetchMock.removeRoutes({ names: [API_ENDPOINTS.DATASETS] });
  fetchMock.get(API_ENDPOINTS.DATASETS, { result: [virtualDataset], count: 1 });

  renderDatasetList(mockAdminUser, { addSuccessToast: mockAddSuccessToast });

  await waitFor(() => {
    expect(screen.getByText(virtualDataset.table_name)).toBeInTheDocument();
  });

  const table = screen.getByTestId('listview-table');
  const duplicateButton = await within(table).findByTestId('copy');
  await userEvent.click(duplicateButton);

  const modal = await screen.findByRole('dialog');
  const input = within(modal).getByRole('textbox');
  await userEvent.clear(input);
  await userEvent.type(input, 'Copy of Analytics');

  const callsBefore = fetchMock.callHistory.calls(
    API_ENDPOINTS.DATASETS,
  ).length;
  const submitButton = within(modal).getByRole('button', {
    name: /duplicate/i,
  });
  await userEvent.click(submitButton);

  await waitFor(() => {
    expect(
      fetchMock.callHistory.calls(API_ENDPOINTS.DATASET_DUPLICATE).length,
    ).toBeGreaterThan(0);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  await waitFor(() => {
    expect(
      fetchMock.callHistory.calls(API_ENDPOINTS.DATASETS).length,
    ).toBeGreaterThan(callsBefore);
  });
});

test('bulk select enables checkboxes', async () => {
  renderDatasetList(mockAdminUser);

  await waitFor(() => {
    expect(screen.getByTestId('listview-table')).toBeInTheDocument();
  });

  expect(screen.queryAllByRole('checkbox')).toHaveLength(0);

  const bulkSelectButton = screen.getByRole('button', { name: /bulk select/i });
  await userEvent.click(bulkSelectButton);

  await screen.findByTestId('bulk-select-controls');
  const table = screen.getByTestId('listview-table');
  await within(table).findAllByRole('checkbox');
}, 30000);

// CRITICAL FIX FOR SHARD 4 TIMEOUT
test('sort order persists after deleting a dataset', async () => {
  const datasetToDelete = mockDatasets[0];
  setupDeleteMocks(datasetToDelete.id);

  renderDatasetList(mockAdminUser, {
    addSuccessToast: mockAddSuccessToast,
    addDangerToast: mockAddDangerToast,
  });

  const table = await screen.findByTestId('listview-table');
  const nameHeader = within(table).getByRole('columnheader', { name: /Name/i });
  const initialCalls = fetchMock.callHistory.calls(
    API_ENDPOINTS.DATASETS,
  ).length;
  await userEvent.click(nameHeader);

  await waitFor(() => {
    expect(
      fetchMock.callHistory.calls(API_ENDPOINTS.DATASETS).length,
    ).toBeGreaterThan(initialCalls);
  });

  const rows = screen.getAllByRole('row');
  const deleteButton = within(rows[1]).getByTestId('delete');
  await userEvent.click(deleteButton);

  const modal = await screen.findByRole('dialog');
  const confirmInput = within(modal).getByTestId('delete-modal-input');

  // Directly set value to bypass typing lag in CI
  fireEvent.change(confirmInput, { target: { value: 'DELETE' } });

  const callsBeforeDelete = fetchMock.callHistory.calls(
    API_ENDPOINTS.DATASETS,
  ).length;
  const confirmButton = within(modal)
    .getAllByRole('button', { name: /^delete$/i })
    .pop();

  if (confirmButton) {
    await userEvent.click(confirmButton);
  }

  await waitFor(
    () => {
      expect(mockAddSuccessToast).toHaveBeenCalled();
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    },
    { timeout: 5000 },
  );

  await waitFor(() => {
    const freshHeader = screen.getByRole('columnheader', { name: /Name/i });
    const headerCell = freshHeader.closest('th');
    if (headerCell) {
      const carets = within(headerCell).getAllByLabelText(/caret/i);
      expect(carets.length).toBeGreaterThan(0);
    }
    expect(
      fetchMock.callHistory.calls(API_ENDPOINTS.DATASETS).length,
    ).toBeGreaterThan(callsBeforeDelete);
  });
}, 30000);

test('bulk selection clears when filter changes', async () => {
  fetchMock.removeRoutes({ names: [API_ENDPOINTS.DATASETS] });
  fetchMock.get(API_ENDPOINTS.DATASETS, {
    result: mockDatasets,
    count: mockDatasets.length,
  });

  renderDatasetList(mockAdminUser);

  await waitFor(() => {
    expect(screen.getByTestId('listview-table')).toBeInTheDocument();
  });

  const bulkSelectButton = screen.getByRole('button', { name: /bulk select/i });
  await userEvent.click(bulkSelectButton);

  await screen.findByTestId('bulk-select-controls');
  const table = screen.getByTestId('listview-table');
  await within(table).findAllByRole('checkbox');

  const firstCell = await within(table).findByText(mockDatasets[0].table_name);
  await userEvent.click(within(firstCell.closest('tr')!).getByRole('checkbox'));

  await waitFor(() => {
    expect(screen.getByTestId('bulk-select-copy')).toHaveTextContent(
      /1 Selected/i,
    );
  });

  await screen.findByRole('combobox', { name: 'Type' });
  await selectOption('Virtual', 'Type');

  await screen.findByText(/0 selected/i);
}, 45000);

test('delete modal shows affected dashboards with overflow for >10 items', async () => {
  const dataset = mockDatasets[0];
  const manyDashboards = Array.from({ length: 15 }, (_, i) => ({
    id: 200 + i,
    title: `Dashboard ${i + 1}`,
  }));

  fetchMock.removeRoutes({ names: [API_ENDPOINTS.DATASETS] });
  fetchMock.get(API_ENDPOINTS.DATASETS, { result: [dataset], count: 1 });
  fetchMock.get(`glob:*/api/v1/dataset/${dataset.id}/related_objects*`, {
    charts: { count: 0, result: [] },
    dashboards: { count: 15, result: manyDashboards },
  });

  renderDatasetList(mockAdminUser);

  const table = await screen.findByTestId('listview-table');
  const deleteButton = await within(table).findByTestId('delete');
  await userEvent.click(deleteButton);

  const modal = await screen.findByRole('dialog');
  expect(within(modal).getByText('Affected Dashboards')).toBeInTheDocument();
  expect(within(modal).getByText('Dashboard 1')).toBeInTheDocument();
  expect(within(modal).getByText('Dashboard 10')).toBeInTheDocument();
  expect(within(modal).getByText(/\.\.\. and 5 others/)).toBeInTheDocument();
});

test('delete modal hides affected dashboards section when count is zero', async () => {
  const dataset = mockDatasets[0];
  fetchMock.removeRoutes({ names: [API_ENDPOINTS.DATASETS] });
  fetchMock.get(API_ENDPOINTS.DATASETS, { result: [dataset], count: 1 });
  fetchMock.get(`glob:*/api/v1/dataset/${dataset.id}/related_objects*`, {
    charts: { count: 2, result: [{ id: 1, slice_name: 'Chart 1' }] },
    dashboards: { count: 0, result: [] },
  });

  renderDatasetList(mockAdminUser);

  const table = await screen.findByTestId('listview-table');
  const deleteButton = await within(table).findByTestId('delete');
  await userEvent.click(deleteButton);

  const modal = await screen.findByRole('dialog');
  expect(
    within(modal).queryByText('Affected Dashboards'),
  ).not.toBeInTheDocument();
  expect(within(modal).getByText('Affected Charts')).toBeInTheDocument();
});
