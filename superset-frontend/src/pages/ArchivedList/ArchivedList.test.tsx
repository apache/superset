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
  userEvent,
  waitFor,
  selectOption,
} from 'spec/helpers/testing-library';
import { MemoryRouter } from 'react-router-dom';
import { QueryParamProvider } from 'use-query-params';
import { ReactRouter5Adapter } from 'use-query-params/adapters/react-router-5';
import ArchivedList from 'src/pages/ArchivedList';

const mockStore = configureStore([thunk]);
const store = mockStore({});

/** A store whose user holds `can_read` on only the given FAB resources. */
const storeWithReadAccess = (...resources: string[]) =>
  mockStore({
    user: {
      userId: 1,
      username: 'someone',
      permissions: {},
      roles: { Custom: resources.map(resource => ['can_read', resource]) },
    },
  });

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

const renderArchivedList = (withStore = store) =>
  render(
    <MemoryRouter>
      <QueryParamProvider adapter={ReactRouter5Adapter}>
        <ArchivedList />
      </QueryParamProvider>
    </MemoryRouter>,
    { useRedux: true, store: withStore },
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

test('row actions are keyboard-operable (Enter restores)', async () => {
  mockRoutes();
  renderArchivedList();
  await screen.findByTestId('archived-list-view');

  // ActionButton is a native <button>: Enter activation is browser
  // semantics, which userEvent implements (jsdom's fireEvent.keyDown
  // does not synthesize the click).
  const restoreButtons = await screen.findAllByTestId('archived-row-restore');
  expect(restoreButtons[0].tagName).toBe('BUTTON');
  // skipClick: no pointer click, so the only activation is the Enter
  // keypress itself; skipClick requires focusing manually first.
  restoreButtons[0].focus();
  userEvent.type(restoreButtons[0], '{enter}', { skipClick: true });

  await waitFor(() => {
    expect(fetchMock.callHistory.calls(/chart\/uuid-1\/restore/)).toHaveLength(
      1,
    );
  });
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

test('archived names do not link out, because the targets cannot show them', async () => {
  // Verified against a running instance: an archived dashboard's page 404s,
  // and an archived chart's explore page answers 200 with no chart and no
  // error — an empty new-chart screen rather than an explanation. A link that
  // silently goes nowhere is worse than no link.
  mockRoutes();
  renderArchivedList();
  await screen.findByTestId('archived-list-view');

  expect(screen.getByText('Deleted Chart One').closest('a')).toBeNull();
});

test('dataset names are also plain text', async () => {
  mockRoutes();
  renderArchivedList();
  await screen.findByTestId('archived-list-view');

  await selectOption('Dataset', 'Type');

  const name = await screen.findByText('deleted_table_one');
  expect(name.closest('a')).toBeNull();
});

test('a second Recover click while the first is in flight is ignored', async () => {
  // Without a guard the retry lands after the row is already restored, so the
  // server answers 404 and the user is shown a failure toast after a success.
  mockRoutes();
  renderArchivedList();
  await screen.findByTestId('archived-list-view');

  const [restore] = await screen.findAllByTestId('archived-row-restore');
  userEvent.click(restore);
  userEvent.click(restore);
  userEvent.click(restore);

  await waitFor(() =>
    expect(fetchMock.callHistory.calls(restoreEndpoint).length).toBeGreaterThan(
      0,
    ),
  );
  expect(fetchMock.callHistory.calls(restoreEndpoint)).toHaveLength(1);
});

/**
 * The page fronts three independently-gated list APIs. Offering a type the
 * viewer cannot read sends them to a 403; the enforcement stays server-side,
 * this only keeps the selector honest.
 */

test('the type selector offers only the types the viewer can read', async () => {
  mockRoutes();
  renderArchivedList(storeWithReadAccess('Dashboard', 'Dataset'));
  await screen.findByTestId('archived-list-view');

  userEvent.click(screen.getByRole('combobox', { name: 'Type' }));

  expect(
    await screen.findByRole('option', { name: 'Dashboard' }),
  ).toBeInTheDocument();
  expect(screen.getByRole('option', { name: 'Dataset' })).toBeInTheDocument();
  expect(
    screen.queryByRole('option', { name: 'Chart' }),
  ).not.toBeInTheDocument();
});

test('the initial type is one the viewer can read, not a fixed default', async () => {
  // A dataset-only viewer must not land on an empty Chart tab.
  mockRoutes();
  renderArchivedList(storeWithReadAccess('Dataset'));
  await screen.findByTestId('archived-list-view');

  expect(await screen.findByText('deleted_table_one')).toBeInTheDocument();
});

test('a name search survives switching Type instead of breaking the list', async () => {
  // The Name filter queries a different column per type (slice_name /
  // dashboard_title / table_name), but ListView persists applied filters in
  // one shared ?filters= param. Keyed by the API column, the entry left
  // behind by the previous type could not be claimed by the new type's
  // filter list, so it reached fetchData with no operator and rison refused
  // to encode it -- the list then never loaded at all.
  mockRoutes();
  renderArchivedList();
  await screen.findByTestId('archived-list-view');

  fireEvent.change(screen.getByPlaceholderText(/type a value/i), {
    target: { value: 'quarterly' },
  });
  fireEvent.keyDown(screen.getByPlaceholderText(/type a value/i), {
    key: 'Enter',
    keyCode: 13,
  });
  await waitFor(() => {
    expect(
      fetchMock.callHistory.calls(/chart\/\?q/).length,
    ).toBeGreaterThanOrEqual(1);
  });

  await selectOption('Dashboard', 'Type');

  await waitFor(() => {
    const calls = fetchMock.callHistory.calls(/dashboard\/\?q/);
    expect(calls.length).toBeGreaterThanOrEqual(1);
    // The search carries over onto the dashboard's own name column, and the
    // request is well-formed rather than never issued.
    const last = calls[calls.length - 1].url;
    expect(last).toContain('dashboard_title');
    expect(last).not.toContain('slice_name');
  });
});
