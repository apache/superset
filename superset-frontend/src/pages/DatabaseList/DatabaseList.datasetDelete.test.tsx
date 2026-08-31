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
import { configureStore } from '@reduxjs/toolkit';
import { render, screen, within } from 'spec/helpers/testing-library';
import userEvent from '@testing-library/user-event';
import DatabaseList from 'src/pages/DatabaseList';

/**
 * The backend refuses to delete a database while any dataset still references
 * it, so the delete confirmation has to name those datasets up front. These
 * tests pin that preview: without it the modal reports only charts, dashboards
 * and SQL Lab tabs, reads as "nothing is attached" for a connection whose only
 * dependents are datasets, and the delete the user then confirms fails with a
 * 422 they had no way to anticipate.
 */

const DATABASE_ID = 1;

const databaseRow = {
  id: DATABASE_ID,
  database_name: 'qa_warehouse',
  backend: 'postgresql',
  allow_run_async: false,
  allow_dml: false,
  allow_file_upload: false,
  expose_in_sqllab: true,
  changed_on_delta_humanized: 'a day ago',
  changed_by: null,
};

const RELATED_OBJECTS_ROUTE = `glob:*/api/v1/database/${DATABASE_ID}/related_objects/*`;

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

const setupMocks = (datasets: {
  count: number;
  result: { id: number; table_name: string }[];
  soft_deleted_count: number;
}) => {
  fetchMock.clearHistory().removeRoutes();
  fetchMock.get('glob:*/api/v1/database/_info*', {
    permissions: ['can_read', 'can_write', 'can_export'],
  });
  fetchMock.get('glob:*/api/v1/database/?q=*', {
    result: [databaseRow],
    count: 1,
  });
  fetchMock.get('glob:*/api/v1/database/related/*', { result: [], count: 0 });
  fetchMock.get(RELATED_OBJECTS_ROUTE, {
    charts: { count: 0, result: [] },
    dashboards: { count: 0, result: [] },
    sqllab_tab_states: { count: 0, result: [] },
    datasets,
  });
  fetchMock.delete(`glob:*/api/v1/database/${DATABASE_ID}`, {});
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
  const deleteButton = await screen.findByTestId('database-delete');
  await userEvent.click(deleteButton);
  return screen.findByRole('dialog');
};

afterEach(() => {
  fetchMock.clearHistory();
  fetchMock.removeRoutes();
});

test('delete confirmation counts and names the datasets built on the connection', async () => {
  setupMocks({
    count: 2,
    result: [
      { id: 10, table_name: 'qa_orders' },
      { id: 11, table_name: 'qa_customers' },
    ],
    soft_deleted_count: 0,
  });
  renderDatabaseList();

  const dialog = await openDeleteModal();

  expect(
    within(dialog).getByText(
      'is linked to 2 datasets and 0 charts that appear on 0 dashboards, and users have 0 SQL Lab tabs using this database open.',
      { exact: false },
    ),
  ).toBeInTheDocument();
  expect(within(dialog).getByText('Affected Datasets')).toBeInTheDocument();
  expect(within(dialog).getByText('qa_orders')).toBeInTheDocument();
  expect(within(dialog).getByText('qa_customers')).toBeInTheDocument();
});

test('a connection with datasets says the delete is blocked rather than inviting a confirmation that cannot succeed', async () => {
  setupMocks({
    count: 1,
    result: [{ id: 10, table_name: 'qa_orders' }],
    soft_deleted_count: 0,
  });
  renderDatabaseList();

  const dialog = await openDeleteModal();

  expect(
    within(dialog).getByText(
      'This database cannot be deleted until its datasets are removed.',
    ),
  ).toBeInTheDocument();
  // The backend rejects this delete outright, so the modal must not claim the
  // connection is merely about to break the objects listed.
  expect(
    within(dialog).queryByText(
      'Are you sure you want to continue? Deleting the database will break those objects.',
    ),
  ).not.toBeInTheDocument();
});

test('deleted datasets still referencing the connection are warned about even though they are no longer listed', async () => {
  // Datasets are soft-deleted by default, so this is the state a user lands in
  // right after deleting the last dataset: their dataset list looks empty, but
  // the reference survives and keeps blocking the connection's delete.
  setupMocks({ count: 0, result: [], soft_deleted_count: 2 });
  renderDatabaseList();

  const dialog = await openDeleteModal();

  expect(
    within(dialog).getByText(
      'This database cannot be deleted yet: 2 deleted datasets still reference it. Their names no longer appear in the dataset list, but the references have to be cleared before the connection can be removed.',
    ),
  ).toBeInTheDocument();
  expect(
    within(dialog).queryByText('Affected Datasets'),
  ).not.toBeInTheDocument();
});

test('a connection with no datasets keeps the ordinary confirmation prompt', async () => {
  setupMocks({ count: 0, result: [], soft_deleted_count: 0 });
  renderDatabaseList();

  const dialog = await openDeleteModal();

  expect(
    within(dialog).getByText(
      'Are you sure you want to continue? Deleting the database will break those objects.',
      { exact: false },
    ),
  ).toBeInTheDocument();
  expect(
    within(dialog).queryByText('Affected Datasets'),
  ).not.toBeInTheDocument();
});
