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
// eslint-disable-next-line import/no-extraneous-dependencies
import fetchMock from 'fetch-mock';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import { configureStore } from '@reduxjs/toolkit';
import { QueryParamProvider } from 'use-query-params';
import {
  render,
  screen,
  userEvent,
  waitFor,
} from 'spec/helpers/testing-library';

// The delete-dataset modal lists the dashboards and charts that would break.
// Those links are plain anchors, so they bypass the router basename that
// prefixes the rest of the app and must apply the application root themselves —
// otherwise they 404 under a subdirectory deployment.
//
// DatasetList is imported statically; mock getBootstrapData and flip
// applicationRoot() per scenario. The name must start with `mock` for Jest's
// hoisted factory to reference it.
const mockApplicationRoot = jest.fn<string, []>(() => '');

jest.mock('src/utils/getBootstrapData', () => {
  const actual = jest.requireActual<
    typeof import('src/utils/getBootstrapData')
  >('src/utils/getBootstrapData');
  return {
    __esModule: true,
    default: actual.default,
    applicationRoot: () => mockApplicationRoot(),
    staticAssetsPrefix: actual.staticAssetsPrefix,
  };
});

// eslint-disable-next-line import/first
import DatasetList from '.';

const DATASET_ID = 1;
const DASHBOARD_ID = 5;
const CHART_ID = 42;

const mockUser = {
  userId: 1,
  firstName: 'Admin',
  lastName: 'User',
};

const mockDataset = {
  id: DATASET_ID,
  table_name: 'test_dataset',
  database: { id: 1, database_name: 'test_db' },
  schema: 'public',
  kind: 'physical',
  changed_by_name: 'admin',
  changed_on_delta_humanized: '1 day ago',
  explore_url: '/explore/?datasource=1__table',
  owners: [],
  extra: null,
  description: null,
  sql: null,
};

const setupMocks = () => {
  fetchMock.reset();
  fetchMock.get('glob:*/api/v1/dataset/_info*', {
    permissions: ['can_read', 'can_write', 'can_export', 'can_duplicate'],
  });
  fetchMock.get('glob:*/api/v1/dataset/?q=*', {
    result: [mockDataset],
    count: 1,
  });
  fetchMock.get(`glob:*/api/v1/dataset/${DATASET_ID}/related_objects*`, {
    charts: {
      count: 1,
      result: [{ id: CHART_ID, slice_name: 'Affected Chart' }],
    },
    dashboards: {
      count: 1,
      result: [{ id: DASHBOARD_ID, title: 'Affected Dashboard' }],
    },
  });
  fetchMock.get('glob:*', { result: [], count: 0 });
};

const createMockStore = () =>
  configureStore({
    reducer: {
      user: (state = mockUser) => state,
      common: (state = { conf: {} }) => state,
    },
    preloadedState: { user: mockUser, common: { conf: {} } },
    middleware: getDefaultMiddleware =>
      getDefaultMiddleware({
        serializableCheck: false,
        immutableCheck: false,
      }),
  });

const openDeleteModal = async () => {
  render(
    <Provider store={createMockStore()}>
      <MemoryRouter>
        <QueryParamProvider>
          <DatasetList user={mockUser} />
        </QueryParamProvider>
      </MemoryRouter>
    </Provider>,
  );

  // Re-query rather than holding a reference: the list re-renders as the
  // permissions request settles, detaching earlier nodes.
  await waitFor(() => {
    expect(screen.getByText('test_dataset')).toBeInTheDocument();
  });
  await userEvent.click(screen.getByTestId('delete'));
  await waitFor(() => {
    expect(screen.getByText('Affected Dashboards')).toBeInTheDocument();
  });
};

beforeEach(() => {
  setupMocks();
  mockApplicationRoot.mockReset();
});

afterEach(() => {
  fetchMock.reset();
});

test('affected dashboard and chart links carry the application root under a subdirectory deployment', async () => {
  mockApplicationRoot.mockReturnValue('/superset');
  await openDeleteModal();

  // The dashboard route is itself /superset/dashboard/<id>, so under an
  // application root of /superset the prefixed href legitimately repeats the
  // segment — same as what `<Link to>` renders via the router's basename on the
  // dashboard and chart list pages.
  expect(
    screen.getByRole('link', { name: 'Affected Dashboard' }),
  ).toHaveAttribute('href', `/superset/superset/dashboard/${DASHBOARD_ID}`);
  expect(screen.getByRole('link', { name: 'Affected Chart' })).toHaveAttribute(
    'href',
    `/superset/explore/?slice_id=${CHART_ID}`,
  );
});

test('affected dashboard and chart links carry a non-colliding application root', async () => {
  mockApplicationRoot.mockReturnValue('/analytics');
  await openDeleteModal();

  expect(
    screen.getByRole('link', { name: 'Affected Dashboard' }),
  ).toHaveAttribute('href', `/analytics/superset/dashboard/${DASHBOARD_ID}`);
  expect(screen.getByRole('link', { name: 'Affected Chart' })).toHaveAttribute(
    'href',
    `/analytics/explore/?slice_id=${CHART_ID}`,
  );
});

test('affected dashboard and chart links are unprefixed under the default root-of-domain deployment', async () => {
  mockApplicationRoot.mockReturnValue('');
  await openDeleteModal();

  expect(
    screen.getByRole('link', { name: 'Affected Dashboard' }),
  ).toHaveAttribute('href', `/superset/dashboard/${DASHBOARD_ID}`);
  expect(screen.getByRole('link', { name: 'Affected Chart' })).toHaveAttribute(
    'href',
    `/explore/?slice_id=${CHART_ID}`,
  );
});
