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
import { useState, type ReactNode } from 'react';
import fetchMock from 'fetch-mock';
import { Tree } from 'react-arborist';
import {
  fireEvent,
  createStore,
  render,
  screen,
  userEvent,
  waitFor,
} from 'spec/helpers/testing-library';
import { TableBrowser } from '.';
import TreeNodeRenderer from './TreeNodeRenderer';
import type { TableReference, TreeNodeData } from './types';
import reducerIndex from 'spec/helpers/reducerIndex';
import type { RootState } from 'src/views/store';
import { initialState } from 'src/SqlLab/fixtures';
import { ToastType } from 'src/components/MessageToasts/types';
import {
  LocalStorageKeys,
  getItem,
  setItem,
} from 'src/utils/localStorageHelpers';

jest.mock('react-virtualized-auto-sizer', () => ({
  AutoSizer: ({
    renderProp,
  }: {
    renderProp: (size: { height: number }) => ReactNode;
  }) => renderProp({ height: 500 }),
}));

let metadataColumns: { name: string; type: string }[];
let metadataShouldFail: boolean;

beforeEach(() => {
  metadataColumns = [{ name: 'order_id', type: 'INTEGER' }];
  metadataShouldFail = false;
  localStorage.removeItem(LocalStorageKeys.SqllabPinnedSchemas);
  fetchMock.get('glob:*/api/v1/database/1/schemas/?*', {
    result: ['public', 'sales'],
  });
  fetchMock.get('glob:*/api/v1/database/1/tables/*', {
    result: [{ label: 'orders', value: 'orders', type: 'table' }],
    count: 1,
  });
  fetchMock.get('glob:*/api/v1/database/1/table_metadata/*', () =>
    metadataShouldFail
      ? { status: 500, body: { message: 'Metadata unavailable' } }
      : { name: 'orders', columns: metadataColumns },
  );
  fetchMock.get('glob:*/api/v1/database/1/table_metadata/extra/*', {});
});
afterEach(() => {
  fetchMock.removeRoutes().clearHistory();
  localStorage.removeItem(LocalStorageKeys.SqllabPinnedSchemas);
});

test('loads tables and reports a selection without a SQL Lab query editor', async () => {
  const onPreviewTable = jest.fn();
  render(<TableBrowser dbId={1} onPreviewTable={onPreviewTable} />, {
    useRedux: true,
  });
  await userEvent.click(await screen.findByText('public'));
  await userEvent.click(await screen.findByText('orders'));
  expect(onPreviewTable).toHaveBeenCalledWith({
    schema: 'public',
    table_name: 'orders',
  });
  expect(await screen.findByText('order_id')).toBeVisible();
  expect(
    screen.queryByRole('button', { name: 'Pin to the result panel' }),
  ).not.toBeInTheDocument();
});

test.each(['Enter', ' '])('table selection supports the %p key', async key => {
  const onPreviewTable = jest.fn();
  render(<TableBrowser dbId={1} onPreviewTable={onPreviewTable} />, {
    useRedux: true,
  });
  await userEvent.click(await screen.findByText('public'));
  const tableRow = (await screen.findByText('orders')).closest('.tree-node');
  expect(tableRow).not.toBeNull();
  fireEvent.keyDown(tableRow!, { key });
  expect(onPreviewTable).toHaveBeenCalledWith({
    schema: 'public',
    table_name: 'orders',
  });
});

test('schema-less databases use an empty schema value for table selections', async () => {
  const onPreviewTable = jest.fn();
  render(
    <TableBrowser
      dbId={1}
      supportsSchemas={false}
      onPreviewTable={onPreviewTable}
    />,
    { useRedux: true },
  );
  await userEvent.click(await screen.findByText('Tables'));
  await userEvent.click(await screen.findByText('orders'));
  expect(onPreviewTable).toHaveBeenCalledWith({
    schema: '',
    table_name: 'orders',
  });
});

test('shows an empty result when no loaded table matches the search', async () => {
  render(<TableBrowser dbId={1} />, { useRedux: true });
  await userEvent.click(await screen.findByText('public'));
  await screen.findByText('orders');
  await userEvent.type(
    screen.getByPlaceholderText('Enter a part of the object name'),
    'missing_table',
  );
  await waitFor(() =>
    expect(screen.getByText('No matching results found')).toBeVisible(),
  );
});

test('opens and loads a schema selected through the connection selector', async () => {
  const onPreviewTable = jest.fn();
  render(
    <TableBrowser dbId={1} schema="public" onPreviewTable={onPreviewTable} />,
    {
      useRedux: true,
    },
  );
  await userEvent.click(await screen.findByText('orders'));
  expect(onPreviewTable).toHaveBeenCalledWith({
    schema: 'public',
    table_name: 'orders',
  });
});

test('collapse all hides loaded tables and permits expanding the schema again', async () => {
  render(<TableBrowser dbId={1} />, { useRedux: true });
  await userEvent.click(await screen.findByText('public'));
  await userEvent.click(await screen.findByText('orders'));
  await screen.findByText('order_id');
  await userEvent.click(screen.getByRole('button', { name: /minus-square/i }));
  expect(screen.queryByText('orders')).not.toBeInTheDocument();
  expect(screen.queryByText('order_id')).not.toBeInTheDocument();
  await userEvent.click(screen.getByText('public'));
  expect(await screen.findByText('orders')).toBeVisible();
});

test('refreshing the schema list displays newly available schemas', async () => {
  fetchMock.removeRoutes().clearHistory();
  let schemas = ['public'];
  fetchMock.get('glob:*/api/v1/database/1/schemas/?*', () => ({
    result: schemas,
  }));
  render(<TableBrowser dbId={1} />, { useRedux: true });
  await screen.findByText('public');
  schemas = ['public', 'archive'];
  await userEvent.click(screen.getByRole('button', { name: /reload/i }));
  expect(await screen.findByText('archive')).toBeVisible();
});

test('schema pins persist, sort the browser, and can be removed', async () => {
  render(<TableBrowser dbId={1} />, { useRedux: true });
  await screen.findByText('sales');
  await userEvent.click(screen.getByTestId('pin-schema-sales'));
  await waitFor(() =>
    expect(screen.getAllByRole('treeitem')[0]).toHaveTextContent('sales'),
  );
  expect(getItem(LocalStorageKeys.SqllabPinnedSchemas, {})).toEqual({
    '1:': ['sales'],
  });
  await userEvent.click(screen.getByTestId('unpin-schema-sales'));
  await waitFor(() =>
    expect(screen.getAllByRole('treeitem')[0]).toHaveTextContent('public'),
  );
  expect(getItem(LocalStorageKeys.SqllabPinnedSchemas, {})).toEqual({
    '1:': [],
  });
});

test('changing catalogs restores their own schema pins without overwriting another catalog', async () => {
  setItem(LocalStorageKeys.SqllabPinnedSchemas, {
    '1:main': ['sales'],
    '1:archive': ['public'],
  });
  const { rerender } = render(<TableBrowser dbId={1} catalog="main" />, {
    useRedux: true,
  });
  await waitFor(() =>
    expect(screen.getAllByRole('treeitem')[0]).toHaveTextContent('sales'),
  );
  rerender(<TableBrowser dbId={1} catalog="archive" />);
  await waitFor(() =>
    expect(screen.getAllByRole('treeitem')[0]).toHaveTextContent('public'),
  );
  expect(getItem(LocalStorageKeys.SqllabPinnedSchemas, {})).toEqual({
    '1:main': ['sales'],
    '1:archive': ['public'],
  });
});

test('refreshing a table replaces its cached column metadata', async () => {
  render(<TableBrowser dbId={1} />, { useRedux: true });
  await userEvent.click(await screen.findByText('public'));
  await userEvent.click(await screen.findByText('orders'));
  await screen.findByText('order_id');
  metadataColumns = [{ name: 'order_total', type: 'NUMERIC' }];
  await userEvent.click(screen.getByTestId('refresh-schema-public-orders'));
  await waitFor(() =>
    expect(
      fetchMock.callHistory.calls('glob:*/api/v1/database/1/table_metadata/?*')
        .length,
    ).toBe(2),
  );
  expect(await screen.findByText('order_total')).toBeVisible();
  expect(screen.queryByText('order_id')).not.toBeInTheDocument();
});

test('reports metadata failures outside SQL Lab and permits retrying the table', async () => {
  metadataShouldFail = true;
  const store = createStore(initialState, reducerIndex);
  render(<TableBrowser dbId={1} />, { useRedux: true, store });
  await userEvent.click(await screen.findByText('public'));
  await userEvent.click(await screen.findByText('orders'));
  await waitFor(() =>
    expect((store.getState() as RootState).messageToasts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          toastType: ToastType.Danger,
          text: 'An error occurred while fetching table metadata for orders',
        }),
      ]),
    ),
  );
  expect(screen.queryByText('order_id')).not.toBeInTheDocument();
  metadataShouldFail = false;
  await userEvent.click(screen.getByText('orders'));
  await userEvent.click(screen.getByText('orders'));
  expect(await screen.findByText('order_id')).toBeVisible();
});

test('clearing the selected schema keeps the browser usable for choosing another table', async () => {
  const { rerender } = render(<TableBrowser dbId={1} schema="public" />, {
    useRedux: true,
  });
  await screen.findByText('orders');
  rerender(<TableBrowser dbId={1} schema={undefined} />);
  expect(await screen.findByText('orders')).toBeVisible();
  expect(
    screen.getByPlaceholderText('Enter a part of the object name'),
  ).toHaveValue('');
});

test('keyboard expansion of a schema does not preview it as a table', async () => {
  const onPreviewTable = jest.fn();
  render(<TableBrowser dbId={1} onPreviewTable={onPreviewTable} />, {
    useRedux: true,
  });
  const schemaRow = (await screen.findByText('public')).closest('.tree-node');
  expect(schemaRow).not.toBeNull();
  fireEvent.keyDown(schemaRow!, { key: 'Enter' });
  expect(await screen.findByText('orders')).toBeVisible();
  expect(onPreviewTable).not.toHaveBeenCalled();
});

test('table nodes retain working pin controls when showTablePins is omitted', async () => {
  const handlePinTable = jest.fn();
  const data: TreeNodeData[] = [
    {
      id: 'table:1:public:orders',
      name: 'orders',
      schema: 'public',
      type: 'table',
    },
  ];
  render(
    <Tree<TreeNodeData> data={data} height={300} width={500}>
      {nodeProps => (
        <TreeNodeRenderer
          {...nodeProps}
          manuallyOpenedNodes={{}}
          loadingNodes={{}}
          searchTerm=""
          catalog={null}
          pinnedTableKeys={new Set()}
          pinnedSchemas={new Set()}
          selectStarMap={{}}
          handleRefreshTables={jest.fn()}
          handlePinTable={handlePinTable}
          handleUnpinTable={jest.fn()}
          handlePinSchema={jest.fn()}
          handleUnpinSchema={jest.fn()}
          refreshTableSchema={jest.fn()}
          sortedTables={{}}
          toggleSortColumns={jest.fn()}
        />
      )}
    </Tree>,
  );
  await userEvent.click(
    await screen.findByRole('button', { name: 'Pin to the result panel' }),
  );
  expect(handlePinTable).toHaveBeenCalledWith('orders', 'public', null);
});

function MultiSelectBrowser({
  maxSelection = 100,
}: {
  maxSelection?: number;
}) {
  const [selectedTables, setSelectedTables] = useState<TableReference[]>([]);
  return (
    <TableBrowser
      dbId={1}
      selectedTables={selectedTables}
      onSelectionChange={setSelectedTables}
      maxSelection={maxSelection}
      showSelectAll
    />
  );
}

test('selects tables from different schemas and clears selection', async () => {
  fetchMock.get('glob:*/api/v1/database/1/schemas/?*', {
    result: ['public', 'sales'],
  });
  fetchMock.get('glob:*/api/v1/database/1/tables/*', {
    result: [{ label: 'orders', value: 'orders', type: 'table' }],
    count: 1,
  });
  render(<MultiSelectBrowser />, { useRedux: true });
  await userEvent.click(await screen.findByText('public'));
  await userEvent.click(
    await screen.findByRole('checkbox', { name: 'Select table public.orders' }),
  );
  await userEvent.click(screen.getByText('sales'));
  await userEvent.click(
    await screen.findByRole('checkbox', { name: 'Select table sales.orders' }),
  );
  expect(screen.getByText('2 selected')).toBeVisible();
  expect(
    screen.getByRole('checkbox', { name: 'Select table public.orders' }),
  ).toBeChecked();
  expect(
    screen.getByRole('checkbox', { name: 'Select table sales.orders' }),
  ).toBeChecked();
  await userEvent.click(
    screen.getByRole('button', { name: 'Clear selection' }),
  );
  expect(screen.getByText('0 selected')).toBeVisible();
});

test('limits selection and permits deselecting at the limit', async () => {
  fetchMock.get('glob:*/api/v1/database/1/schemas/?*', {
    result: ['public', 'sales'],
  });
  fetchMock.get('glob:*/api/v1/database/1/tables/*', {
    result: [{ label: 'orders', value: 'orders', type: 'table' }],
    count: 1,
  });
  render(<MultiSelectBrowser maxSelection={1} />, { useRedux: true });
  await userEvent.click(await screen.findByText('public'));
  await userEvent.click(
    await screen.findByRole('checkbox', { name: 'Select table public.orders' }),
  );
  await userEvent.click(screen.getByText('sales'));
  expect(
    await screen.findByRole('checkbox', { name: 'Select table sales.orders' }),
  ).toBeDisabled();
  await userEvent.click(
    screen.getByRole('checkbox', { name: 'Select table public.orders' }),
  );
  expect(
    screen.getByRole('checkbox', { name: 'Select table sales.orders' }),
  ).toBeEnabled();
});

test('select-all includes only loaded tables matching the search', async () => {
  fetchMock.get('glob:*/api/v1/database/1/schemas/?*', {
    result: ['public', 'sales'],
  });
  fetchMock.get('glob:*/api/v1/database/1/tables/*', {
    result: [{ label: 'orders', value: 'orders', type: 'table' }],
    count: 1,
  });
  render(<MultiSelectBrowser />, { useRedux: true });
  expect(screen.getByRole('button', { name: 'Select all' })).toBeDisabled();
  await userEvent.click(await screen.findByText('public'));
  await screen.findByRole('checkbox', { name: 'Select table public.orders' });
  await userEvent.type(
    screen.getByPlaceholderText('Enter a part of the object name'),
    'orders',
  );
  await userEvent.click(screen.getByRole('button', { name: 'Select all' }));
  expect(screen.getByText('1 selected')).toBeVisible();
  expect(
    fetchMock.callHistory.calls('glob:*/api/v1/database/1/tables/*'),
  ).toHaveLength(1);
});

test('omits checkboxes by default when multi-select is not enabled', async () => {
  fetchMock.get('glob:*/api/v1/database/1/schemas/?*', {
    result: ['public'],
  });
  fetchMock.get('glob:*/api/v1/database/1/tables/*', {
    result: [{ label: 'orders', value: 'orders', type: 'table' }],
    count: 1,
  });
  render(<TableBrowser dbId={1} />, { useRedux: true });
  await userEvent.click(await screen.findByText('public'));
  await screen.findByText('orders');
  expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
});
