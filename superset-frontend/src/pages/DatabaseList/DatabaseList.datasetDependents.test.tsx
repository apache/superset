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
 * Datasets are dependents of a database connection, and
 * `DeleteDatabaseCommand.validate` refuses to delete a connection while any
 * dataset still references it. The confirmation modal used to enumerate only
 * charts, dashboards and SQL Lab tabs, so a connection whose only dependents
 * were datasets read as "linked to 0 charts ... 0 dashboards" and promised
 * that deleting "will break those objects" -- then the delete failed with a
 * toast the user only saw after typing DELETE.
 *
 * These tests pin the dataset dependents being named and counted up front, and
 * the copy telling the truth about the delete being blocked.
 */

const DATABASE_ID = 7;

const databaseRow = {
  id: DATABASE_ID,
  database_name: 'qa_postgres',
  backend: 'postgresql',
  allow_run_async: false,
  allow_dml: false,
  allow_file_upload: false,
  expose_in_sqllab: true,
  changed_on_delta_humanized: 'a day ago',
  changed_by: null,
};

const DATABASE_LIST_ROUTE = 'glob:*/api/v1/database/?q=*';
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

const dataset = (id: number, tableName: string) => ({
  id,
  table_name: tableName,
  schema: 'public',
});

const setupMocks = ({
  datasets,
  datasetCount,
}: {
  datasets: { id: number; table_name: string }[];
  datasetCount?: number;
}) => {
  fetchMock.clearHistory().removeRoutes();
  fetchMock.get('glob:*/api/v1/database/_info*', {
    permissions: ['can_read', 'can_write', 'can_export'],
  });
  fetchMock.get('glob:*/api/v1/database/related/*', { result: [], count: 0 });
  fetchMock.get(RELATED_OBJECTS_ROUTE, {
    charts: { count: 0, result: [] },
    dashboards: { count: 0, result: [] },
    sqllab_tab_states: { count: 0, result: [] },
    datasets: {
      count: datasetCount ?? datasets.length,
      result: datasets,
    },
  });
  fetchMock.get(DATABASE_LIST_ROUTE, {
    result: [databaseRow],
    count: 1,
  });
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

test('the delete confirmation names the dataset dependents of a connection', async () => {
  setupMocks({ datasets: [dataset(1, 'qa_orders'), dataset(2, 'qa_users')] });
  renderDatabaseList();

  const dialog = await openDeleteModal();

  expect(within(dialog).getByText('Affected Datasets')).toBeInTheDocument();
  expect(within(dialog).getByText('qa_orders')).toBeInTheDocument();
  expect(within(dialog).getByText('qa_users')).toBeInTheDocument();
});

test('the delete confirmation says the delete is blocked, not that it will break objects', async () => {
  // The backend refuses the delete outright while datasets exist, so the
  // modal must not promise a destructive outcome that cannot happen.
  setupMocks({ datasets: [dataset(1, 'qa_orders'), dataset(2, 'qa_users')] });
  renderDatabaseList();

  const dialog = await openDeleteModal();

  expect(
    within(dialog).getByText(
      /cannot be deleted because 2 datasets are still attached to it/i,
    ),
  ).toBeInTheDocument();
  expect(
    within(dialog).queryByText(/will break those objects/i),
  ).not.toBeInTheDocument();
});

test('a single dataset dependent is announced in the singular', async () => {
  setupMocks({ datasets: [dataset(1, 'qa_orders')] });
  renderDatabaseList();

  const dialog = await openDeleteModal();

  expect(
    within(dialog).getByText(
      /cannot be deleted because 1 dataset is still attached to it/i,
    ),
  ).toBeInTheDocument();
});

test('a connection with no datasets keeps the existing dependents copy', async () => {
  setupMocks({ datasets: [] });
  renderDatabaseList();

  const dialog = await openDeleteModal();

  expect(
    within(dialog).getByText(/will break those objects/i),
  ).toBeInTheDocument();
  expect(
    within(dialog).queryByText('Affected Datasets'),
  ).not.toBeInTheDocument();
});

test('datasets the user cannot access are counted but not named', async () => {
  // The endpoint access-filters the names while leaving the count intact, so
  // the modal must explain the block using the full count and list only what
  // came back.
  setupMocks({ datasets: [dataset(1, 'qa_orders')], datasetCount: 3 });
  renderDatabaseList();

  const dialog = await openDeleteModal();

  expect(
    within(dialog).getByText(
      /cannot be deleted because 3 datasets are still attached to it/i,
    ),
  ).toBeInTheDocument();
  expect(within(dialog).getByText('qa_orders')).toBeInTheDocument();
  expect(within(dialog).getByText('... and 2 others')).toBeInTheDocument();
});

test('a fully access-filtered dataset list still explains the block', async () => {
  // The caller can see the connection but none of its datasets. The count
  // still has to explain why the delete is refused, without an empty list.
  setupMocks({ datasets: [], datasetCount: 2 });
  renderDatabaseList();

  const dialog = await openDeleteModal();

  expect(
    within(dialog).getByText(
      /cannot be deleted because 2 datasets are still attached to it/i,
    ),
  ).toBeInTheDocument();
  expect(
    within(dialog).queryByText('Affected Datasets'),
  ).not.toBeInTheDocument();
});

test('the dataset list footer reports dependents beyond the listed page', async () => {
  setupMocks({
    datasets: Array.from({ length: 12 }, (_, i) =>
      dataset(i + 1, `qa_table_${i + 1}`),
    ),
  });
  renderDatabaseList();

  const dialog = await openDeleteModal();

  expect(within(dialog).getByText('qa_table_10')).toBeInTheDocument();
  expect(within(dialog).queryByText('qa_table_11')).not.toBeInTheDocument();
  expect(within(dialog).getByText('... and 2 others')).toBeInTheDocument();
});
