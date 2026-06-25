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
import thunk from 'redux-thunk';
import configureStore from 'redux-mock-store';
import fetchMock from 'fetch-mock';
import {
  render,
  screen,
  fireEvent,
  waitFor,
  selectOption,
} from 'spec/helpers/testing-library';
import { MemoryRouter } from 'react-router-dom';
import { QueryParamProvider } from 'use-query-params';
import { ReactRouter5Adapter } from 'use-query-params/adapters/react-router-5';
import ArchivedList from 'src/pages/ArchivedList';

const mockStore = configureStore([thunk]);
const store = mockStore({});

const infoEndpoint = 'glob:*/api/v1/chart/_info*';
const listEndpoint = 'glob:*/api/v1/chart/?*';
const restoreEndpoint = 'glob:*/api/v1/chart/*/restore';
const purgeEndpoint = 'glob:*/api/v1/chart/*/purge';
const dashboardInfoEndpoint = 'glob:*/api/v1/dashboard/_info*';
const dashboardListEndpoint = 'glob:*/api/v1/dashboard/?*';
const datasetInfoEndpoint = 'glob:*/api/v1/dataset/_info*';
const datasetListEndpoint = 'glob:*/api/v1/dataset/?*';

const mockDashboards = [
  { id: 10, uuid: 'dash-uuid-1', dashboard_title: 'Deleted Dashboard One' },
];

const mockDatasets = [
  { id: 20, uuid: 'ds-uuid-1', table_name: 'deleted_table_one' },
];

const mockCharts = [
  {
    id: 1,
    uuid: 'uuid-1',
    slice_name: 'Deleted Chart One',
    changed_by: { first_name: 'Ada', last_name: 'Lovelace' },
    deleted_at: '2026-06-20T10:00:00',
    url: '/explore/?slice_id=1',
  },
  {
    id: 2,
    uuid: 'uuid-2',
    slice_name: 'Deleted Chart Two',
    changed_by: null,
    deleted_at: '2026-06-19T10:00:00',
  },
];

// Register routes for a single test. `restoreStatus` lets a test exercise the
// success path (200) or a failure (e.g. 422/404). Info is registered before the
// list so `_info` requests resolve to it rather than the broader list glob.
const mockRoutes = (restoreStatus = 200) => {
  fetchMock.get(infoEndpoint, { permissions: ['can_read', 'can_write'] });
  fetchMock.get(listEndpoint, { result: mockCharts, count: mockCharts.length });
  fetchMock.post(restoreEndpoint, restoreStatus === 200 ? {} : restoreStatus);
  fetchMock.post(purgeEndpoint, {});
  fetchMock.get(dashboardInfoEndpoint, {
    permissions: ['can_read', 'can_write'],
  });
  fetchMock.get(dashboardListEndpoint, {
    result: mockDashboards,
    count: mockDashboards.length,
  });
  fetchMock.get(datasetInfoEndpoint, {
    permissions: ['can_read', 'can_write'],
  });
  fetchMock.get(datasetListEndpoint, {
    result: mockDatasets,
    count: mockDatasets.length,
  });
};

const renderArchivedList = () =>
  render(
    <MemoryRouter>
      <QueryParamProvider adapter={ReactRouter5Adapter}>
        <ArchivedList />
      </QueryParamProvider>
    </MemoryRouter>,
    { useRedux: true, store },
  );

beforeEach(() => {
  fetchMock.removeRoutes();
  fetchMock.clearHistory();
});

test('renders archived rows with Name and Type columns', async () => {
  mockRoutes();
  renderArchivedList();

  expect(await screen.findByTestId('archived-list-view')).toBeInTheDocument();
  expect(await screen.findByText('Deleted Chart One')).toBeInTheDocument();
  expect(screen.getByText('Deleted Chart Two')).toBeInTheDocument();
  // Name + Type column headers render.
  expect(screen.getAllByText('Name').length).toBeGreaterThan(0);
  expect(screen.getAllByText('Type').length).toBeGreaterThan(0);
});

test('issues the deleted-only baseline filter on the list request', async () => {
  mockRoutes();
  renderArchivedList();

  await waitFor(() => {
    const calls = fetchMock.callHistory.calls(/chart\/\?q/);
    expect(calls.length).toBeGreaterThanOrEqual(1);
    expect(calls[0].url).toContain('col:id,opr:chart_deleted_state,value:only');
  });
});

test('restore posts to the per-type endpoint and refetches on success', async () => {
  mockRoutes();
  renderArchivedList();
  await screen.findByTestId('archived-list-view');

  const restoreButtons = await screen.findAllByTestId('archived-row-restore');
  fireEvent.click(restoreButtons[0]);

  await waitFor(() => {
    const calls = fetchMock.callHistory.calls(/chart\/uuid-1\/restore/);
    expect(calls).toHaveLength(1);
  });
  // refreshData() re-fetches the list (initial + post-restore refetch).
  await waitFor(() => {
    expect(
      fetchMock.callHistory.calls(/chart\/\?q/).length,
    ).toBeGreaterThanOrEqual(2);
  });
});

test('restore failure surfaces an error and leaves the row in place', async () => {
  mockRoutes(422);
  renderArchivedList();
  await screen.findByTestId('archived-list-view');

  const restoreButtons = await screen.findAllByTestId('archived-row-restore');
  fireEvent.click(restoreButtons[0]);

  await waitFor(() => {
    expect(fetchMock.callHistory.calls(/chart\/uuid-1\/restore/)).toHaveLength(
      1,
    );
  });
  // No refetch on failure — the row stays.
  expect(fetchMock.callHistory.calls(/chart\/\?q/)).toHaveLength(1);
  expect(screen.getByText('Deleted Chart One')).toBeInTheDocument();
});

test('delete permanently confirms then posts to the purge endpoint and refetches', async () => {
  mockRoutes();
  renderArchivedList();
  await screen.findByTestId('archived-list-view');

  // Open the "delete forever" confirm for the first row...
  fireEvent.click((await screen.findAllByTestId('archived-row-purge'))[0]);
  // ...which is a plain danger confirm (no "type DELETE" input).
  expect(screen.queryByTestId('delete-modal-input')).not.toBeInTheDocument();
  fireEvent.click(await screen.findByText('Delete'));

  await waitFor(() => {
    expect(fetchMock.callHistory.calls(/chart\/uuid-1\/purge/)).toHaveLength(1);
  });
  await waitFor(() => {
    expect(
      fetchMock.callHistory.calls(/chart\/\?q/).length,
    ).toBeGreaterThanOrEqual(2);
  });
});

test('name search refetches with a contains filter on the name field', async () => {
  mockRoutes();
  renderArchivedList();
  await screen.findByTestId('archived-list-view');

  const searchInput = screen.getByPlaceholderText(/type a value/i);
  fireEvent.change(searchInput, { target: { value: 'invoice' } });
  fireEvent.keyDown(searchInput, { key: 'Enter', keyCode: 13 });

  await waitFor(() => {
    const hit = fetchMock.callHistory
      .calls(/chart\/\?q/)
      .find(call =>
        call.url.includes('(col:slice_name,opr:chart_all_text,value:invoice)'),
      );
    expect(hit).toBeTruthy();
  });
});

test('switching Type fetches the newly selected resource with its deleted-state filter', async () => {
  mockRoutes();
  renderArchivedList();
  await screen.findByTestId('archived-list-view');

  await selectOption('Dashboard', 'Type');

  await waitFor(() => {
    const calls = fetchMock.callHistory.calls(/dashboard\/\?q/);
    expect(calls.length).toBeGreaterThanOrEqual(1);
    expect(calls[calls.length - 1].url).toContain(
      'col:id,opr:dashboard_deleted_state,value:only',
    );
  });
});

test('time-range preset refetches with a deleted_at greater-than filter', async () => {
  mockRoutes();
  renderArchivedList();
  await screen.findByTestId('archived-list-view');

  // The Time-range preset renders as a compact filter pill; selecting an
  // option applies immediately (no Apply button).
  fireEvent.click(screen.getByTestId('compact-filter-pill'));
  fireEvent.click(await screen.findByText('Last 30 days'));

  await waitFor(() => {
    const hit = fetchMock.callHistory
      .calls(/chart\/\?q/)
      .find(call => call.url.includes('col:deleted_at,opr:gt'));
    expect(hit).toBeTruthy();
  });
});

test('shows relative deletion time and the deleting user', async () => {
  mockRoutes();
  renderArchivedList();
  await screen.findByTestId('archived-list-view');

  // deleted_at is humanized to a relative "... ago" string.
  expect(screen.getAllByText(/ago$/i).length).toBeGreaterThan(0);
  // changed_by is rendered as the deleting user.
  expect(screen.getByText('Ada Lovelace')).toBeInTheDocument();
});

test('renders chart names as preview links', async () => {
  mockRoutes();
  renderArchivedList();
  await screen.findByTestId('archived-list-view');

  const link = screen.getByText('Deleted Chart One').closest('a');
  expect(link).not.toBeNull();
  expect(link).toHaveAttribute('href', expect.stringContaining('slice_id=1'));
});

test('renders dataset names as plain text with no preview link', async () => {
  mockRoutes();
  renderArchivedList();
  await screen.findByTestId('archived-list-view');

  await selectOption('Dataset', 'Type');

  const name = await screen.findByText('deleted_table_one');
  expect(name.closest('a')).toBeNull();
});
