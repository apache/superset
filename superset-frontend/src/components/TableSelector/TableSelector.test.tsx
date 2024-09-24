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

import { act } from 'react-dom/test-utils';
import {
  render,
  screen,
  waitFor,
  within,
  defaultStore as store,
} from 'spec/helpers/testing-library';
import { api } from 'src/hooks/apiResources/queryApi';
import fetchMock from 'fetch-mock';
import userEvent from '@testing-library/user-event';
import TableSelector, { TableSelectorMultiple } from '.';

const createProps = (props = {}) => ({
  database: {
    id: 1,
    database_name: 'main',
    backend: 'sqlite',
  },
  schema: 'test_schema',
  handleError: jest.fn(),
  ...props,
});

const getTableMockFunction = () =>
  ({
    count: 4,
    result: [
      { label: 'table_a', value: 'table_a' },
      { label: 'table_b', value: 'table_b' },
      { label: 'table_c', value: 'table_c' },
      { label: 'table_d', value: 'table_d' },
    ],
  }) as any;

const databaseApiRoute = 'glob:*/api/v1/database/?*';
const catalogApiRoute = 'glob:*/api/v1/database/*/catalogs/?*';
const schemaApiRoute = 'glob:*/api/v1/database/*/schemas/?*';
const tablesApiRoute = 'glob:*/api/v1/database/*/tables/*';

const getSelectItemContainer = (select: HTMLElement) =>
  select.parentElement?.parentElement?.getElementsByClassName(
    'ant-select-selection-item',
  );

beforeEach(() => {
  fetchMock.get(databaseApiRoute, { result: [] });
});

afterEach(() => {
  act(() => {
    store.dispatch(api.util.resetApiState());
  });
  fetchMock.reset();
});

test('renders with default props', async () => {
  fetchMock.get(catalogApiRoute, { result: [] });
  fetchMock.get(schemaApiRoute, { result: [] });
  fetchMock.get(tablesApiRoute, getTableMockFunction());

  const props = createProps();
  render(<TableSelector {...props} />, { useRedux: true, store });
  const databaseSelect = screen.getByRole('combobox', {
    name: 'Select database or type to search databases',
  });
  const schemaSelect = screen.getByRole('combobox', {
    name: 'Select schema or type to search schemas',
  });
  const tableSelect = screen.getByRole('combobox', {
    name: 'Select table or type to search tables',
  });
  await waitFor(() => {
    expect(databaseSelect).toBeInTheDocument();
    expect(schemaSelect).toBeInTheDocument();
    expect(tableSelect).toBeInTheDocument();
  });
});

test('skips select all options', async () => {
  fetchMock.get(catalogApiRoute, { result: [] });
  fetchMock.get(schemaApiRoute, { result: ['test_schema'] });
  fetchMock.get(tablesApiRoute, getTableMockFunction());

  const props = createProps();
  render(<TableSelector {...props} tableSelectMode="multiple" />, {
    useRedux: true,
    store,
  });
  const tableSelect = screen.getByRole('combobox', {
    name: 'Select table or type to search tables',
  });
  userEvent.click(tableSelect);
  expect(
    await screen.findByRole('option', { name: 'table_a' }),
  ).toBeInTheDocument();
  expect(screen.queryByRole('option', { name: /Select All/i })).toBeFalsy();
});

test('renders table options without Select All option', async () => {
  fetchMock.get(catalogApiRoute, { result: [] });
  fetchMock.get(schemaApiRoute, { result: ['test_schema'] });
  fetchMock.get(tablesApiRoute, getTableMockFunction());

  const props = createProps();
  render(<TableSelector {...props} />, { useRedux: true, store });
  const tableSelect = screen.getByRole('combobox', {
    name: 'Select table or type to search tables',
  });
  userEvent.click(tableSelect);
  expect(
    await screen.findByRole('option', { name: 'table_a' }),
  ).toBeInTheDocument();
  expect(
    await screen.findByRole('option', { name: 'table_b' }),
  ).toBeInTheDocument();
});

test('renders disabled without schema', async () => {
  fetchMock.get(catalogApiRoute, { result: [] });
  fetchMock.get(schemaApiRoute, { result: [] });
  fetchMock.get(tablesApiRoute, getTableMockFunction());

  const props = createProps();
  render(<TableSelector {...props} schema={undefined} />, {
    useRedux: true,
    store,
  });
  const tableSelect = screen.getByRole('combobox', {
    name: 'Select table or type to search tables',
  });
  await waitFor(() => {
    expect(tableSelect).toBeDisabled();
  });
});

test('table select retain value if not in SQL Lab mode', async () => {
  fetchMock.get(catalogApiRoute, { result: [] });
  fetchMock.get(schemaApiRoute, { result: ['test_schema'] });
  fetchMock.get(tablesApiRoute, getTableMockFunction());

  const callback = jest.fn();
  const props = createProps({
    onTableSelectChange: callback,
    sqlLabMode: false,
  });

  render(<TableSelector {...props} />, { useRedux: true, store });

  const tableSelect = screen.getByRole('combobox', {
    name: 'Select table or type to search tables',
  });

  expect(screen.queryByText('table_a')).not.toBeInTheDocument();
  expect(getSelectItemContainer(tableSelect)).toHaveLength(0);

  userEvent.click(tableSelect);

  expect(
    await screen.findByRole('option', { name: 'table_a' }),
  ).toBeInTheDocument();

  await waitFor(() => {
    userEvent.click(screen.getAllByText('table_a')[1]);
  });

  expect(callback).toHaveBeenCalled();

  const selectedValueContainer = getSelectItemContainer(tableSelect);

  expect(selectedValueContainer).toHaveLength(1);
  expect(
    await within(selectedValueContainer?.[0] as HTMLElement).findByText(
      'table_a',
    ),
  ).toBeInTheDocument();
});

test('table multi select retain all the values selected', async () => {
  fetchMock.get(catalogApiRoute, { result: [] });
  fetchMock.get(schemaApiRoute, { result: ['test_schema'] });
  fetchMock.get(tablesApiRoute, getTableMockFunction());

  const callback = jest.fn();
  const props = createProps({
    onTableSelectChange: callback,
  });

  render(<TableSelectorMultiple {...props} />, { useRedux: true, store });

  const tableSelect = screen.getByRole('combobox', {
    name: 'Select table or type to search tables',
  });

  expect(screen.queryByText('table_a')).not.toBeInTheDocument();
  expect(getSelectItemContainer(tableSelect)).toHaveLength(0);

  userEvent.click(tableSelect);

  await waitFor(async () => {
    const item = await screen.findAllByText('table_b');
    userEvent.click(item[item.length - 1]);
  });

  await waitFor(async () => {
    const item = await screen.findAllByText('table_c');
    userEvent.click(item[item.length - 1]);
  });

  const selection1 = await screen.findByRole('option', { name: 'table_b' });
  expect(selection1).toHaveAttribute('aria-selected', 'true');

  const selection2 = await screen.findByRole('option', { name: 'table_c' });
  expect(selection2).toHaveAttribute('aria-selected', 'true');
});
