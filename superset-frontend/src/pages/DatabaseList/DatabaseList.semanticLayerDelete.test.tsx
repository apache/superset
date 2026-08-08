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
import fetchMock from 'fetch-mock';
import rison from 'rison';
import { configureStore } from '@reduxjs/toolkit';
import { render, screen, waitFor, within } from 'spec/helpers/testing-library';
import userEvent from '@testing-library/user-event';
import DatabaseList from 'src/pages/DatabaseList';

/**
 * Deleting a semantic layer cascade-deletes its semantic views (SC-108418).
 * These tests pin the delete confirmation's cascade warning: the dependent
 * views are counted and named before the user confirms, and a failed lookup
 * still opens the modal with an uncounted warning rather than blocking.
 */

const SL_UUID = '6a000000-0000-4000-8000-000000000001';

const semanticLayerRow = {
  source_type: 'semantic_layer',
  uuid: SL_UUID,
  database_name: 'Demo Semantic Layer',
  backend: 'Demo',
  sl_type: 'demo',
  description: null,
  allow_run_async: null,
  allow_dml: null,
  allow_file_upload: null,
  expose_in_sqllab: null,
  changed_on_delta_humanized: 'a day ago',
  changed_by: null,
};

const CONNECTIONS_ROUTE = 'glob:*/api/v1/semantic_layer/connections/*';
const DATASOURCE_ROUTE = 'glob:*/api/v1/datasource/?*';
const DELETE_ROUTE = `glob:*/api/v1/semantic_layer/${SL_UUID}`;

const mockUser = {
  userId: 1,
  firstName: 'Admin',
  lastName: 'User',
  roles: { Admin: [['can_write', 'Database']] },
  permissions: {},
  isActive: true,
  email: 'admin@example.com',
  createdOn: '2026-01-01T00:00:00',
};

const dependentView = (id: number, name: string) => ({
  id,
  table_name: name,
  kind: 'semantic_view',
  source_type: 'semantic_layer',
});

const setupMocks = ({
  dependents,
  dependentsError = false,
}: {
  dependents: { id: number; table_name: string }[];
  dependentsError?: boolean;
}) => {
  fetchMock.clearHistory().removeRoutes();
  fetchMock.get('glob:*/api/v1/database/_info*', {
    permissions: ['can_read', 'can_write', 'can_export'],
  });
  fetchMock.get('glob:*/api/v1/database/?q=*', { result: [], count: 0 });
  fetchMock.get('glob:*/api/v1/database/related/*', { result: [], count: 0 });
  fetchMock.get(CONNECTIONS_ROUTE, {
    result: [semanticLayerRow],
    count: 1,
  });
  if (dependentsError) {
    fetchMock.get(DATASOURCE_ROUTE, 500, { name: DATASOURCE_ROUTE });
  } else {
    fetchMock.get(
      DATASOURCE_ROUTE,
      { result: dependents, count: dependents.length },
      { name: DATASOURCE_ROUTE },
    );
  }
  fetchMock.delete(DELETE_ROUTE, {});
};

const renderDatabaseList = () => {
  const store = configureStore({
    reducer: {
      user: (state = mockUser) => state,
      common: (
        state = {
          conf: {
            CSV_EXTENSIONS: ['csv'],
            EXCEL_EXTENSIONS: ['xls'],
            COLUMNAR_EXTENSIONS: ['parquet'],
            ALLOWED_EXTENSIONS: ['csv', 'xls', 'parquet'],
            SYNC_DB_PERMISSIONS_IN_ASYNC_MODE: false,
          },
        },
      ) => state,
    },
    middleware: getDefaultMiddleware =>
      getDefaultMiddleware({ serializableCheck: false, immutableCheck: false }),
  });

  return render(<DatabaseList user={mockUser} />, {
    store,
    useQueryParams: true,
    useRouter: true,
  });
};

const openDeleteModal = async () => {
  const deleteButton = await screen.findByTestId('Delete');
  await userEvent.click(deleteButton);
  return screen.findByRole('dialog');
};

beforeEach(() => {
  window.featureFlags = { SEMANTIC_LAYERS: true } as never;
});

afterEach(() => {
  window.featureFlags = {} as never;
  fetchMock.clearHistory();
  fetchMock.removeRoutes();
});

test('delete confirmation warns about cascade-deleting dependent views by count and name', async () => {
  setupMocks({
    dependents: [
      dependentView(1, 'marketing'),
      dependentView(2, 'sales'),
      dependentView(3, 'orders'),
    ],
  });
  renderDatabaseList();

  const dialog = await openDeleteModal();

  expect(
    within(dialog).getByText(
      'This will also permanently delete its 3 semantic views. Charts built on those views will stop working.',
    ),
  ).toBeInTheDocument();
  expect(
    within(dialog).getByText('Affected semantic views'),
  ).toBeInTheDocument();
  expect(within(dialog).getByText('marketing')).toBeInTheDocument();
  expect(within(dialog).getByText('sales')).toBeInTheDocument();
  expect(within(dialog).getByText('orders')).toBeInTheDocument();

  // The dependent lookup must target this layer's views.
  const lookupCalls = fetchMock.callHistory.calls(DATASOURCE_ROUTE);
  expect(lookupCalls).toHaveLength(1);
  const q = new URL(lookupCalls[0].url).searchParams.get('q') as string;
  expect(rison.decode(q)).toMatchObject({
    filters: [{ col: 'semantic_layer_uuid', opr: 'eq', value: SL_UUID }],
  });
});

test('a single dependent view is announced in the singular', async () => {
  setupMocks({ dependents: [dependentView(1, 'marketing')] });
  renderDatabaseList();

  const dialog = await openDeleteModal();

  expect(
    within(dialog).getByText(
      'This will also permanently delete its 1 semantic view. Charts built on that view will stop working.',
    ),
  ).toBeInTheDocument();
});

test('an access-filtered empty response still shows a generic cascade warning', async () => {
  setupMocks({ dependents: [] });
  renderDatabaseList();

  const dialog = await openDeleteModal();

  expect(
    within(dialog).getByText(
      'Deleting this semantic layer also permanently deletes any semantic views it contains, and charts built on those views will stop working. The affected views could not be listed.',
    ),
  ).toBeInTheDocument();
  expect(
    within(dialog).queryByText('Affected semantic views'),
  ).not.toBeInTheDocument();
});

test('a failed dependent lookup still opens the modal with an uncounted warning', async () => {
  setupMocks({ dependents: [], dependentsError: true });
  renderDatabaseList();

  const dialog = await openDeleteModal();

  expect(
    within(dialog).getByText(
      'Deleting this semantic layer also permanently deletes any semantic views it contains, and charts built on those views will stop working. The affected views could not be listed.',
    ),
  ).toBeInTheDocument();
});

test('the overflow footer reports dependent views beyond the listed page', async () => {
  // The lookup pages at 10 names; the count is the full total.
  setupMocks({ dependents: [] });
  fetchMock.removeRoutes({ names: [DATASOURCE_ROUTE] });
  fetchMock.get(
    DATASOURCE_ROUTE,
    {
      result: Array.from({ length: 10 }, (_, i) =>
        dependentView(i + 1, `view_${i + 1}`),
      ),
      count: 12,
    },
    { name: DATASOURCE_ROUTE },
  );
  renderDatabaseList();

  const dialog = await openDeleteModal();

  expect(
    within(dialog).getByText(
      'This will also permanently delete its 12 semantic views. Charts built on those views will stop working.',
    ),
  ).toBeInTheDocument();
  expect(within(dialog).getByText('view_10')).toBeInTheDocument();
  expect(within(dialog).getByText('... and 2 others')).toBeInTheDocument();
});

test('the overflow footer uses the singular for one unlisted view', async () => {
  setupMocks({ dependents: [] });
  fetchMock.removeRoutes({ names: [DATASOURCE_ROUTE] });
  fetchMock.get(
    DATASOURCE_ROUTE,
    {
      result: Array.from({ length: 10 }, (_, i) =>
        dependentView(i + 1, `view_${i + 1}`),
      ),
      count: 11,
    },
    { name: DATASOURCE_ROUTE },
  );
  renderDatabaseList();

  const dialog = await openDeleteModal();

  expect(within(dialog).getByText('... and 1 other')).toBeInTheDocument();
});

test('a pending lookup disables repeated delete requests and shows progress', async () => {
  setupMocks({ dependents: [dependentView(1, 'marketing')] });
  fetchMock.removeRoutes({ names: [DATASOURCE_ROUTE] });
  let releaseLookup: () => void = () => {};
  const lookupGate = new Promise<void>(resolve => {
    releaseLookup = resolve;
  });
  fetchMock.get(
    DATASOURCE_ROUTE,
    async () => {
      await lookupGate;
      return { result: [dependentView(1, 'marketing')], count: 1 };
    },
    { name: DATASOURCE_ROUTE },
  );
  renderDatabaseList();

  const deleteButton = await screen.findByTestId('Delete');
  await userEvent.click(deleteButton);
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  await waitFor(() => {
    expect(screen.getByTestId('Delete')).toHaveAttribute(
      'aria-disabled',
      'true',
    );
  });
  expect(screen.getByTestId('Delete')).toHaveAccessibleName(
    'Loading dependent semantic views',
  );

  await userEvent.click(screen.getByTestId('Delete'));
  expect(fetchMock.callHistory.calls(DATASOURCE_ROUTE)).toHaveLength(1);

  releaseLookup();
  expect(await screen.findByRole('dialog')).toBeInTheDocument();
});

test('confirming the modal deletes the semantic layer', async () => {
  setupMocks({ dependents: [dependentView(1, 'marketing')] });
  renderDatabaseList();

  const dialog = await openDeleteModal();

  await userEvent.type(
    within(dialog).getByTestId('delete-modal-input'),
    'DELETE',
  );
  await userEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));

  await waitFor(() => {
    expect(fetchMock.callHistory.calls(DELETE_ROUTE)).toHaveLength(1);
  });
});
