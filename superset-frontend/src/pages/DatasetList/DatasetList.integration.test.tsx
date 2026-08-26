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
import { selectPillOption } from 'spec/helpers/testing-library';
import {
  setupMocks,
  renderDatasetList,
  mockAdminUser,
  mockDatasets,
  setupBulkDeleteMocks,
  mockDatasetListEndpoints,
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

  fetchMock.clearHistory();
  fetchMock.removeRoutes();
  jest.restoreAllMocks();
});

test('ListView provider correctly merges filter + sort + pagination state on refetch', async () => {
  // This test verifies that when multiple state sources are combined,
  // the ListView provider correctly merges them for the API call.
  // Component tests verify individual pieces persist; this verifies they COMBINE correctly.

  mockDatasetListEndpoints({
    result: mockDatasets,
    count: mockDatasets.length,
  });

  renderDatasetList(mockAdminUser);

  await waitFor(() => {
    expect(screen.getByTestId('listview-table')).toBeInTheDocument();
  });

  // 1. Apply a sort by clicking Name header
  const table = screen.getByTestId('listview-table');
  const nameHeader = within(table).getByRole('columnheader', {
    name: /Name/i,
  });

  const callsBeforeSort = fetchMock.callHistory.calls(
    API_ENDPOINTS.DATASOURCE_COMBINED,
  ).length;
  await userEvent.click(nameHeader);

  // Wait for sort-triggered refetch to complete before applying filter
  await waitFor(() => {
    expect(
      fetchMock.callHistory.calls(API_ENDPOINTS.DATASOURCE_COMBINED).length,
    ).toBeGreaterThan(callsBeforeSort);
  });

  // 2. Apply a filter using selectPillOption helper (compact pill UI)
  const beforeFilterCallCount = fetchMock.callHistory.calls(
    API_ENDPOINTS.DATASOURCE_COMBINED,
  ).length;
  await selectPillOption('Virtual', 'Type');

  // Wait for filter API call to complete
  await waitFor(() => {
    const calls = fetchMock.callHistory.calls(
      API_ENDPOINTS.DATASOURCE_COMBINED,
    );
    expect(calls.length).toBeGreaterThan(beforeFilterCallCount);
  });

  // 3. Verify the final API call contains ALL three state pieces merged correctly
  const calls = fetchMock.callHistory.calls(API_ENDPOINTS.DATASOURCE_COMBINED);
  const latestCall = calls[calls.length - 1];
  const { url } = latestCall;

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

  mockDatasetListEndpoints({
    result: mockDatasets,
    count: mockDatasets.length,
  });

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
  const datasetsCallCountBeforeDelete = fetchMock.callHistory.calls(
    API_ENDPOINTS.DATASOURCE_COMBINED,
  ).length;

  const confirmButton = within(modal)
    .getAllByRole('button', { name: /^delete$/i })
    .pop();
  await userEvent.click(confirmButton!);

  // 3. Wait for bulk delete API call to be made
  await waitFor(() => {
    const deleteCalls = fetchMock.callHistory.calls(
      API_ENDPOINTS.DATASET_BULK_DELETE,
    );
    expect(deleteCalls.length).toBeGreaterThan(0);
  });

  // Wait for modal to close
  await waitFor(() => {
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  // Wait for datasets refetch after delete
  await waitFor(() => {
    const datasetsCallCount = fetchMock.callHistory.calls(
      API_ENDPOINTS.DATASOURCE_COMBINED,
    ).length;
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

test('bulk delete confirm names the charts and dashboards that will break', async () => {
  // Regression for sc-116465: bulk delete used a static "Type DELETE to
  // confirm" dialog that named no dependents, while single-row delete named
  // affected charts and counted dashboards. Selecting datasets in bulk must
  // surface the same blast-radius warning, aggregated across the selection.
  const withDependents = mockDatasets[0]; // id 1 -- has a chart on a dashboard
  const noDependents = mockDatasets[1]; // id 2 -- clean

  mockDatasetListEndpoints({
    result: [withDependents, noDependents],
    count: 2,
  });

  // The bulk confirm fans out related_objects per selected dataset. id 1 has a
  // dependent chart + dashboard; id 2 has none. The union is what the modal
  // must show.
  fetchMock.get(`glob:*/api/v1/dataset/${withDependents.id}/related_objects*`, {
    charts: {
      count: 1,
      result: [{ id: 101, slice_name: 'QA Delete Target Chart' }],
    },
    dashboards: {
      count: 1,
      result: [{ id: 201, title: 'Executive Dashboard' }],
    },
  });
  fetchMock.get(`glob:*/api/v1/dataset/${noDependents.id}/related_objects*`, {
    charts: { count: 0, result: [] },
    dashboards: { count: 0, result: [] },
  });
  fetchMock.delete(API_ENDPOINTS.DATASET_BULK_DELETE, {
    message: '2 datasets deleted successfully',
  });

  renderDatasetList(mockAdminUser);
  await waitFor(() => {
    expect(screen.getByTestId('listview-table')).toBeInTheDocument();
  });

  await userEvent.click(screen.getByRole('button', { name: /bulk select/i }));
  const bulkSelectControls = await screen.findByTestId('bulk-select-controls');
  const table = screen.getByTestId('listview-table');
  await within(table).findAllByRole('checkbox');

  for (const name of [withDependents.table_name, noDependents.table_name]) {
    // eslint-disable-next-line no-await-in-loop
    const cell = await within(table).findByText(name);
    // eslint-disable-next-line no-await-in-loop
    await userEvent.click(within(cell.closest('tr')!).getByRole('checkbox'));
  }
  await waitFor(() => {
    expect(screen.getByTestId('bulk-select-copy')).toHaveTextContent(
      /2 Selected/i,
    );
  });

  await userEvent.click(
    await within(bulkSelectControls).findByRole('button', { name: 'Delete' }),
  );

  const modal = await screen.findByRole('dialog');

  // The dependents are named and counted, matching the single-row delete modal.
  // findByText waits out the async related_objects fan-out.
  expect(await within(modal).findByText('Affected Charts')).toBeInTheDocument();
  expect(within(modal).getByText('Affected Dashboards')).toBeInTheDocument();
  expect(within(modal).getByText('QA Delete Target Chart')).toBeInTheDocument();
  expect(within(modal).getByText('Executive Dashboard')).toBeInTheDocument();
  expect(modal).toHaveTextContent(
    /linked to 1 charts that appear on 1 dashboards/i,
  );
}, 45000);

test('bulk delete confirm de-duplicates a dashboard shared by two datasets', async () => {
  // The blast-radius count is a union, not a sum: two selected datasets that
  // both feed the same dashboard must count that dashboard once, or the warning
  // over-states the damage and erodes trust in the number.
  const first = mockDatasets[0]; // id 1
  const second = mockDatasets[1]; // id 2

  mockDatasetListEndpoints({ result: [first, second], count: 2 });

  // Both datasets list the SAME dashboard (id 201) but distinct charts.
  const sharedDashboard = { id: 201, title: 'Executive Dashboard' };
  fetchMock.get(`glob:*/api/v1/dataset/${first.id}/related_objects*`, {
    charts: { count: 1, result: [{ id: 101, slice_name: 'Chart A' }] },
    dashboards: { count: 1, result: [sharedDashboard] },
  });
  fetchMock.get(`glob:*/api/v1/dataset/${second.id}/related_objects*`, {
    charts: { count: 1, result: [{ id: 102, slice_name: 'Chart B' }] },
    dashboards: { count: 1, result: [sharedDashboard] },
  });
  fetchMock.delete(API_ENDPOINTS.DATASET_BULK_DELETE, {
    message: '2 datasets deleted successfully',
  });

  renderDatasetList(mockAdminUser);
  await waitFor(() => {
    expect(screen.getByTestId('listview-table')).toBeInTheDocument();
  });

  await userEvent.click(screen.getByRole('button', { name: /bulk select/i }));
  const bulkSelectControls = await screen.findByTestId('bulk-select-controls');
  const table = screen.getByTestId('listview-table');
  await within(table).findAllByRole('checkbox');

  for (const name of [first.table_name, second.table_name]) {
    // eslint-disable-next-line no-await-in-loop
    const cell = await within(table).findByText(name);
    // eslint-disable-next-line no-await-in-loop
    await userEvent.click(within(cell.closest('tr')!).getByRole('checkbox'));
  }
  await waitFor(() => {
    expect(screen.getByTestId('bulk-select-copy')).toHaveTextContent(
      /2 Selected/i,
    );
  });

  await userEvent.click(
    await within(bulkSelectControls).findByRole('button', { name: 'Delete' }),
  );

  const modal = await screen.findByRole('dialog');

  // 2 distinct charts, 1 distinct dashboard (deduped) -- not 2 dashboards.
  await within(modal).findByText('Affected Charts');
  expect(modal).toHaveTextContent(
    /linked to 2 charts that appear on 1 dashboards/i,
  );
  // The shared dashboard is listed a single time.
  expect(within(modal).getAllByText('Executive Dashboard')).toHaveLength(1);
}, 45000);

/**
 * Renders the list with one regular dataset plus the given semantic-view row,
 * bulk-selects both, opens the bulk Archive confirm, and asserts the modal
 * keeps the danger treatment: no recovery promise, type-DELETE gate present.
 */
async function expectMixedBulkArchiveKeepsDangerTreatment(semanticView: {
  [key: string]: unknown;
  table_name: string;
}) {
  window.featureFlags = { SOFT_DELETE: true } as never;
  try {
    setupBulkDeleteMocks();
    mockDatasetListEndpoints({
      result: [mockDatasets[0], semanticView],
      count: 2,
    });

    renderDatasetList(mockAdminUser);
    await waitFor(() => {
      expect(screen.getByTestId('listview-table')).toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole('button', { name: /bulk select/i }));
    const bulkSelectControls = await screen.findByTestId(
      'bulk-select-controls',
    );
    const table = screen.getByTestId('listview-table');
    await within(table).findAllByRole('checkbox');

    for (const name of [mockDatasets[0].table_name, semanticView.table_name]) {
      // eslint-disable-next-line no-await-in-loop
      const cell = await within(table).findByText(name);
      // eslint-disable-next-line no-await-in-loop
      await userEvent.click(within(cell.closest('tr')!).getByRole('checkbox'));
    }
    await waitFor(() => {
      expect(screen.getByTestId('bulk-select-copy')).toHaveTextContent(
        /2 Selected/i,
      );
    });

    await userEvent.click(
      await within(bulkSelectControls).findByRole('button', {
        name: 'Archive',
      }),
    );

    const modal = await screen.findByRole('dialog');
    expect(modal).toHaveTextContent(/deleted permanently/i);
    expect(modal).not.toHaveTextContent(/recover them there/i);
    // The type-DELETE gate returns for the irreversible part.
    expect(within(modal).getByTestId('delete-modal-input')).toBeInTheDocument();
  } finally {
    window.featureFlags = {} as never;
  }
}

test('a bulk archive containing a semantic view drops the recoverable promise', async () => {
  // Semantic views have no soft-delete: their endpoint hard-deletes. A mixed
  // selection must therefore not be confirmed with "you can recover them
  // there" copy and the type-DELETE friction removed -- that is a recoverable
  // promise attached to an irreversible action. The modal keeps the danger
  // treatment and says plainly which part of the selection dies.
  //
  // Both discriminators, as the real combined endpoint emits them:
  // SemanticViewListSchema serializes kind AND source_type as Constants,
  // so a row with one but not the other is unrepresentable on the wire.
  await expectMixedBulkArchiveKeepsDangerTreatment({
    ...mockDatasets[1],
    id: 99,
    table_name: 'orders_semantic',
    kind: 'semantic_view',
    source_type: 'semantic_layer',
  });
});

test('semantic-view classification holds without the optional source_type', async () => {
  // The discriminating case: `source_type` is optional on the row type, so a
  // row carrying only `kind` is legal under the TS contract even though the
  // live combined endpoint always emits both. Classification must key off the
  // required `kind` -- this test FAILS against a `source_type`-based
  // predicate (the row silently counts as a regular dataset and the modal
  // promises recovery for something the handler would destroy), and passes
  // against `isSemanticView`. It exists so that predicate cannot quietly
  // revert.
  // mockDatasets carries no source_type, so this row has `kind` only.
  await expectMixedBulkArchiveKeepsDangerTreatment({
    ...mockDatasets[1],
    id: 99,
    table_name: 'orders_semantic',
    kind: 'semantic_view',
  });
});
