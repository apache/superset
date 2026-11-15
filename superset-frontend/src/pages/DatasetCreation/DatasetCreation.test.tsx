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
import type { ReactNode } from 'react';
import fetchMock from 'fetch-mock';
import rison from 'rison';
import {
  render,
  screen,
  userEvent,
  waitFor,
} from 'spec/helpers/testing-library';
import { LocalStorageKeys, setItem } from 'src/utils/localStorageHelpers';
import AddDataset, { datasetReducer } from '.';
import { DatasetActionType } from 'src/features/datasets/AddDataset/types';

const mockHistoryPush = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useHistory: () => ({ push: mockHistoryPush }),
  useParams: () => ({ datasetId: undefined }),
}));
jest.mock(
  'react-virtualized-auto-sizer',
  () =>
    ({ children }: { children: (size: { height: number }) => ReactNode }) =>
      children({ height: 500 }),
);

const database = {
  id: 1,
  database_name: 'examples',
  backend: 'postgresql',
  allow_multi_catalog: true,
};
beforeEach(() => {
  localStorage.removeItem(LocalStorageKeys.Database);
  mockHistoryPush.mockClear();
  fetchMock.get('glob:*/api/v1/database/?q*', {
    count: 2,
    result: [
      database,
      { id: 2, database_name: 'analytics', backend: 'postgresql' },
    ],
  });
  fetchMock.get('glob:*/api/v1/database/1/catalogs/*', {
    result: ['main', 'archive'],
    count: 2,
  });
  fetchMock.get('glob:*/api/v1/database/*/schemas/?*', { result: ['public'] });
  fetchMock.get('glob:*/api/v1/database/1/tables/*', call => {
    const query = new URL(call.url, 'http://localhost').searchParams.get('q');
    const { catalog_name: catalog } = rison.decode(query ?? '()') as {
      catalog_name?: string;
    };
    const tableName = catalog === 'archive' ? 'archived_orders' : 'orders';
    return {
      result: [{ label: tableName, value: tableName, type: 'table' }],
      count: 1,
    };
  });
  fetchMock.get('glob:*/api/v1/database/1/table_metadata/*', {
    name: 'orders',
    columns: [{ name: 'order_id', type: 'INTEGER' }],
  });
  fetchMock.get('glob:*/api/v1/database/1/table_metadata/extra/*', {});
  fetchMock.get('glob:*/api/v1/dataset/?q*', { result: [], count: 0 });
});
afterEach(() => {
  fetchMock.removeRoutes().clearHistory();
  localStorage.removeItem(LocalStorageKeys.Database);
});

async function selectOrders() {
  await userEvent.click(await screen.findByText('public', { exact: true }));
  await userEvent.click(await screen.findByText('orders', { exact: true }));
  await waitFor(() =>
    expect(screen.getAllByText('order_id').length).toBeGreaterThan(0),
  );
  await waitFor(() =>
    expect(
      screen.getByRole('button', {
        name: 'Create and explore dataset',
      }),
    ).toBeEnabled(),
  );
}

test('selects a table through the browser and clears its preview when the connection changes', async () => {
  setItem(LocalStorageKeys.Database, {
    ...database,
    allow_multi_catalog: false,
  });
  render(<AddDataset />, { useRedux: true, useRouter: true });
  await selectOrders();
  const connection = screen.getByRole('combobox', {
    name: /Select (database|data connection) or type/i,
  });
  await userEvent.click(connection);
  await userEvent.click(await screen.findByText('analytics', { exact: true }));
  await waitFor(() =>
    expect(screen.queryByText('order_id')).not.toBeInTheDocument(),
  );
  expect(
    screen.getByRole('button', {
      name: 'Create and explore dataset',
    }),
  ).toBeDisabled();
  expect(screen.getByText('New dataset')).toBeVisible();
});

test('changing the catalog clears the selected table and column preview', async () => {
  setItem(LocalStorageKeys.Database, database);
  render(<AddDataset />, { useRedux: true, useRouter: true });
  const catalog = screen.getByRole('combobox', {
    name: 'Select catalog or type to search catalogs',
  });
  await userEvent.click(catalog);
  await userEvent.click(await screen.findByText('main', { exact: true }));
  await selectOrders();
  await userEvent.click(catalog);
  await userEvent.click(await screen.findByText('archive', { exact: true }));
  await userEvent.click(await screen.findByText('public', { exact: true }));
  expect(
    await screen.findByText('archived_orders', { exact: true }),
  ).toBeVisible();
  expect(screen.queryByText('orders', { exact: true })).not.toBeInTheDocument();
  await waitFor(() =>
    expect(screen.queryByText('order_id')).not.toBeInTheDocument(),
  );
  expect(
    screen.getByRole('button', {
      name: 'Create and explore dataset',
    }),
  ).toBeDisabled();
});

test('single-table creation submits the selected schema and keeps the existing explore redirect', async () => {
  setItem(LocalStorageKeys.Database, {
    ...database,
    allow_multi_catalog: false,
  });
  fetchMock.post('glob:*/api/v1/dataset/', { id: 10 });
  render(<AddDataset />, { useRedux: true, useRouter: true });
  await selectOrders();
  await userEvent.click(
    screen.getByRole('button', {
      name: 'Create and explore dataset',
    }),
  );
  await waitFor(() =>
    expect(mockHistoryPush).toHaveBeenCalledWith('/chart/add/?dataset=orders'),
  );
  const call = fetchMock.callHistory.lastCall('glob:*/api/v1/dataset/');
  expect(JSON.parse(String(call?.options.body))).toEqual({
    database: 1,
    catalog: null,
    schema: 'public',
    table_name: 'orders',
  });
});

test('source changes clear the selected table in the dataset reducer', () => {
  const selected = {
    db: database,
    catalog: 'main',
    schema: 'public',
    table_name: 'orders',
  };
  expect(
    datasetReducer(selected, {
      type: DatasetActionType.SelectDatabase,
      payload: { db: { id: 2, database_name: 'analytics' } },
    }),
  ).toMatchObject({ table_name: null, schema: null, catalog: null });
  expect(
    datasetReducer(selected, {
      type: DatasetActionType.SelectCatalog,
      payload: { name: 'catalog', value: 'archive' },
    }),
  ).toMatchObject({ table_name: null, schema: null, catalog: 'archive' });
});
