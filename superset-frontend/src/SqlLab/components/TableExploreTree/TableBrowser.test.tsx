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
import {
  fireEvent,
  render,
  screen,
  userEvent,
  waitFor,
} from 'spec/helpers/testing-library';
import { TableBrowser } from '.';

jest.mock(
  'react-virtualized-auto-sizer',
  () =>
    ({ children }: { children: (size: { height: number }) => ReactNode }) =>
      children({ height: 500 }),
);

beforeEach(() => {
  fetchMock.get('glob:*/api/v1/database/1/schemas/?*', {
    result: ['public', 'sales'],
  });
  fetchMock.get('glob:*/api/v1/database/1/tables/*', {
    result: [{ label: 'orders', value: 'orders', type: 'table' }],
    count: 1,
  });
  fetchMock.get('glob:*/api/v1/database/1/table_metadata/*', {
    name: 'orders',
    columns: [{ name: 'order_id', type: 'INTEGER' }],
  });
  fetchMock.get('glob:*/api/v1/database/1/table_metadata/extra/*', {});
});
afterEach(() => fetchMock.removeRoutes().clearHistory());

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

test('table selection supports keyboard activation', async () => {
  const onPreviewTable = jest.fn();
  render(<TableBrowser dbId={1} onPreviewTable={onPreviewTable} />, {
    useRedux: true,
  });
  await userEvent.click(await screen.findByText('public'));
  const tableRow = (await screen.findByText('orders')).closest('.tree-node');
  expect(tableRow).not.toBeNull();
  fireEvent.keyDown(tableRow!, { key: 'Enter' });
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
