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
} from 'spec/helpers/testing-library';
import { MemoryRouter } from 'react-router-dom';
import { QueryParamProvider } from 'use-query-params';
import { ReactRouter5Adapter } from 'use-query-params/adapters/react-router-5';
import DeletedList from 'src/pages/DeletedList';

const mockStore = configureStore([thunk]);
const store = mockStore({});

const infoEndpoint = 'glob:*/api/v1/chart/_info*';
const listEndpoint = 'glob:*/api/v1/chart/?*';
const restoreEndpoint = 'glob:*/api/v1/chart/*/restore';

const mockCharts = [
  {
    id: 1,
    uuid: 'uuid-1',
    slice_name: 'Deleted Chart One',
    changed_by: { first_name: 'Ada', last_name: 'Lovelace' },
    deleted_at: '2026-06-20T10:00:00',
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
};

const renderDeletedList = () =>
  render(
    <MemoryRouter>
      <QueryParamProvider adapter={ReactRouter5Adapter}>
        <DeletedList />
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
  renderDeletedList();

  expect(await screen.findByTestId('deleted-list-view')).toBeInTheDocument();
  expect(await screen.findByText('Deleted Chart One')).toBeInTheDocument();
  expect(screen.getByText('Deleted Chart Two')).toBeInTheDocument();
  // Name + Type column headers render.
  expect(screen.getAllByText('Name').length).toBeGreaterThan(0);
  expect(screen.getAllByText('Type').length).toBeGreaterThan(0);
});

test('issues the deleted-only baseline filter on the list request', async () => {
  mockRoutes();
  renderDeletedList();

  await waitFor(() => {
    const calls = fetchMock.callHistory.calls(/chart\/\?q/);
    expect(calls.length).toBeGreaterThanOrEqual(1);
    expect(calls[0].url).toContain('col:id,opr:chart_deleted_state,value:only');
  });
});

test('restore posts to the per-type endpoint and refetches on success', async () => {
  mockRoutes();
  renderDeletedList();
  await screen.findByTestId('deleted-list-view');

  const restoreButtons = await screen.findAllByTestId('deleted-row-restore');
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
  renderDeletedList();
  await screen.findByTestId('deleted-list-view');

  const restoreButtons = await screen.findAllByTestId('deleted-row-restore');
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
