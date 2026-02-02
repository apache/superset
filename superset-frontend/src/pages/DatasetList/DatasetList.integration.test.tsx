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
import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import fetchMock from 'fetch-mock';
import rison from 'rison';
import { selectOption } from 'spec/helpers/testing-library';
import {
  setupMocks,
  renderDatasetList,
  mockAdminUser,
  mockDatasets,
  setupBulkDeleteMocks,
  API_ENDPOINTS,
} from './DatasetList.testHelpers';

/**
 * Integration Contract Tests
 *
 * These tests verify multi-component orchestration that cannot be tested
 * in component isolation. Unlike component tests which mock all dependencies,
 * integration tests use real Redux/React Query/Router state management.
 *
 * Only 2 tests are needed here - most workflows are covered by component "+1" tests.
 */

jest.mock('src/utils/export');

// Increase default timeout for tests that involve multiple async operations
jest.setTimeout(15000);

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

  fetchMock.resetHistory();
  fetchMock.restore();
  jest.restoreAllMocks();
});

test('ListView provider correctly merges filter + sort + pagination state on refetch', async () => {
  // This test verifies that when multiple state sources are combined,
  // the ListView provider correctly merges them for the API call.
  // Component tests verify individual pieces persist; this verifies they COMBINE correctly.

  fetchMock.get(
    API_ENDPOINTS.DATASETS,
    { result: mockDatasets, count: mockDatasets.length },
    { overwriteRoutes: true },
  );

  renderDatasetList(mockAdminUser);

  await waitFor(() => {
    expect(screen.getByTestId('listview-table')).toBeInTheDocument();
  });

  // 1. Apply a sort by clicking Name header
  const table = screen.getByTestId('listview-table');
  const nameHeader = within(table).getByRole('columnheader', {
    name: /Name/i,
  });

  const callsBeforeSort = fetchMock.calls(API_ENDPOINTS.DATASETS).length;
  await userEvent.click(nameHeader);

  // Wait for sort-triggered refetch to complete before applying filter
  await waitFor(() => {
    expect(fetchMock.calls(API_ENDPOINTS.DATASETS).length).toBeGreaterThan(
      callsBeforeSort,
    );
  });

  // 2. Apply a filter using selectOption helper
  const beforeFilterCallCount = fetchMock.calls(API_ENDPOINTS.DATASETS).length;
  await selectOption('Virtual', 'Type');

  // Wait for filter API call to complete
  await waitFor(() => {
    const calls = fetchMock.calls(API_ENDPOINTS.DATASETS);
    expect(calls.length).toBeGreaterThan(beforeFilterCallCount);
  });

  // 3. Verify the final API call contains ALL three state pieces merged correctly
  const calls = fetchMock.calls(API_ENDPOINTS.DATASETS);
  const latestCall = calls[calls.length - 1];
  const url = latestCall[0] as string;

  // Decode the rison payload using URL parser
  const risonPayload = new URL(url, 'http://localhost').searchParams.get('q');
  expect(risonPayload).toBeTruthy();
  // searchParams.get() already URL-decodes, so pass directly to rison.decode
  const decoded = rison.decode(risonPayload!) as Record<string, unknown>;

  // Verify ALL three pieces of state are present and merged:
  // 1. Sort (order_column)
  expect(decoded?.order_column).toBeTruthy();

  // 2. Filter (filters array)
  const filters = Array.isArray(decoded?.filters) ? decoded.filters : [];
  const hasTypeFilter = filters.some(
    (filter: Record<string, unknown>) =>
      filter?.col === 'sql' && filter?.value === false,
  );
  expect(hasTypeFilter).toBe(true);

  // 3. Pagination (page_size is present with default value)
  expect(decoded?.page_size).toBeTruthy();

  // This confirms ListView provider merges state from multiple sources correctly
}, 30000);

test('bulk action orchestration: selection → action → cleanup cycle works correctly', async () => {
  // This test verifies the full bulk operation cycle across multiple components:
  // 1. Bulk mode UI (selection state)
  // 2. Bulk action handler (delete operation)
  // 3. Selection cleanup (state reset)

  setupBulkDeleteMocks();

  fetchMock.get(
    API_ENDPOINTS.DATASETS,
    { result: mockDatasets, count: mockDatasets.length },
    { overwriteRoutes: true },
  );

  renderDatasetList(mockAdminUser);

  await waitFor(() => {
    expect(screen.getByTestId('listview-table')).toBeInTheDocument();
  });

  // 1. Enter bulk mode and select items
  const bulkSelectButton = screen.getByRole('button', {
    name: /bulk select/i,
  });
  await userEvent.click(bulkSelectButton);

  // Wait for bulk select controls container to appear first (fast query)
  const bulkSelectControls = await screen.findByTestId('bulk-select-controls');

  // Wait for table checkboxes to render (findAllByRole is faster than waitFor with getAll)
  const table = screen.getByTestId('listview-table');
  await within(table).findAllByRole('checkbox');

  // Select first dataset by name (scoped to table, async to avoid race)
  const firstCell = await within(table).findByText(mockDatasets[0].table_name);
  const firstRow = firstCell.closest('tr');
  expect(firstRow).toBeInTheDocument();
  await userEvent.click(within(firstRow!).getByRole('checkbox'));

  // Wait for first selection to register before clicking second (prevents stale node)
  await waitFor(() => {
    expect(screen.getByTestId('bulk-select-copy')).toHaveTextContent(
      /1 Selected/i,
    );
  });

  // Select second dataset (scoped to table, async to avoid race)
  const secondCell = await within(table).findByText(mockDatasets[1].table_name);
  const secondRow = secondCell.closest('tr');
  expect(secondRow).toBeInTheDocument();
  await userEvent.click(within(secondRow!).getByRole('checkbox'));

  // Wait for both selections to register
  await waitFor(() => {
    expect(screen.getByTestId('bulk-select-copy')).toHaveTextContent(
      /2 Selected/i,
    );
  });

  // 2. Execute bulk delete - scoped to toolbar to avoid row delete buttons
  const bulkDeleteButton = await within(bulkSelectControls).findByRole(
    'button',
    { name: 'Delete' },
  );
  await userEvent.click(bulkDeleteButton);

  // Confirm in modal - verify by stable anchor (delete-modal-input is unique to delete modals)
  const modal = await screen.findByRole('dialog');
  const confirmInput = within(modal).getByTestId('delete-modal-input');
  expect(confirmInput).toBeInTheDocument();
  await userEvent.clear(confirmInput);
  await userEvent.type(confirmInput, 'DELETE');

  // Capture datasets call count before confirming
  const datasetsCallCountBeforeDelete = fetchMock.calls(
    API_ENDPOINTS.DATASETS,
  ).length;

  const confirmButton = within(modal)
    .getAllByRole('button', { name: /^delete$/i })
    .pop();
  await userEvent.click(confirmButton!);

  // 3. Wait for bulk delete API call to be made
  await waitFor(() => {
    const deleteCalls = fetchMock.calls(API_ENDPOINTS.DATASET_BULK_DELETE);
    expect(deleteCalls.length).toBeGreaterThan(0);
  });

  // Wait for modal to close
  await waitFor(() => {
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  // Wait for datasets refetch after delete
  await waitFor(() => {
    const datasetsCallCount = fetchMock.calls(API_ENDPOINTS.DATASETS).length;
    expect(datasetsCallCount).toBeGreaterThan(datasetsCallCountBeforeDelete);
  });

  // 4. Verify selection count shows 0 (selections cleared but still in bulk mode)
  // After bulk delete, items are deselected but bulk mode may remain active
  await waitFor(() => {
    expect(screen.getByTestId('bulk-select-copy')).toHaveTextContent(
      /0 selected/i,
    );
  });

  // This confirms the full bulk operation cycle coordinates correctly:
  // selection state → action handler → list refresh → state cleanup
}, 45000);
