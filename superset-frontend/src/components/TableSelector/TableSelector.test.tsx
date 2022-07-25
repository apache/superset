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

import React from 'react';
import { render, screen, waitFor, within } from 'spec/helpers/testing-library';
import { SupersetClient } from '@superset-ui/core';
import { act } from 'react-dom/test-utils';
import userEvent from '@testing-library/user-event';
import TableSelector, { TableSelectorMultiple } from '.';

const SupersetClientGet = jest.spyOn(SupersetClient, 'get');

const createProps = (props = {}) => ({
  database: {
    id: 1,
    database_name: 'main',
    backend: 'sqlite',
    allow_multi_schema_metadata_fetch: false,
  },
  schema: 'test_schema',
  handleError: jest.fn(),
  ...props,
});

afterEach(() => {
  jest.clearAllMocks();
});

const getSchemaMockFunction = async () =>
  ({
    json: {
      result: ['schema_a', 'schema_b'],
    },
  } as any);

const getTableMockFunction = async () =>
  ({
    json: {
      options: [
        { label: 'table_a', value: 'table_a' },
        { label: 'table_b', value: 'table_b' },
        { label: 'table_c', value: 'table_c' },
        { label: 'table_d', value: 'table_d' },
      ],
    },
  } as any);

const getSelectItemContainer = (select: HTMLElement) =>
  select.parentElement?.parentElement?.getElementsByClassName(
    'ant-select-selection-item',
  );

test('renders with default props', async () => {
  SupersetClientGet.mockImplementation(getTableMockFunction);

  const props = createProps();
  render(<TableSelector {...props} />, { useRedux: true });
  const databaseSelect = screen.getByRole('combobox', {
    name: 'Select database or type database name',
  });
  const schemaSelect = screen.getByRole('combobox', {
    name: 'Select schema or type schema name',
  });
  const tableSelect = screen.getByRole('combobox', {
    name: 'Select table or type table name',
  });
  await waitFor(() => {
    expect(databaseSelect).toBeInTheDocument();
    expect(schemaSelect).toBeInTheDocument();
    expect(tableSelect).toBeInTheDocument();
  });
});

test('renders table options', async () => {
  SupersetClientGet.mockImplementation(getTableMockFunction);

  const props = createProps();
  render(<TableSelector {...props} />, { useRedux: true });
  const tableSelect = screen.getByRole('combobox', {
    name: 'Select table or type table name',
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
  SupersetClientGet.mockImplementation(getTableMockFunction);

  const props = createProps();
  render(<TableSelector {...props} schema={undefined} />, { useRedux: true });
  const tableSelect = screen.getByRole('combobox', {
    name: 'Select table or type table name',
  });
  await waitFor(() => {
    expect(tableSelect).toBeDisabled();
  });
});

test('table options are notified after schema selection', async () => {
  SupersetClientGet.mockImplementation(getSchemaMockFunction);

  const callback = jest.fn();
  const props = createProps({
    onTablesLoad: callback,
    schema: undefined,
  });
  render(<TableSelector {...props} />, { useRedux: true });

  const schemaSelect = screen.getByRole('combobox', {
    name: 'Select schema or type schema name',
  });
  expect(schemaSelect).toBeInTheDocument();
  expect(callback).not.toHaveBeenCalled();

  userEvent.click(schemaSelect);

  expect(
    await screen.findByRole('option', { name: 'schema_a' }),
  ).toBeInTheDocument();
  expect(
    await screen.findByRole('option', { name: 'schema_b' }),
  ).toBeInTheDocument();

  SupersetClientGet.mockImplementation(getTableMockFunction);

  act(() => {
    userEvent.click(screen.getAllByText('schema_a')[1]);
  });

  await waitFor(() => {
    expect(callback).toHaveBeenCalledWith([
      { label: 'table_a', value: 'table_a' },
      { label: 'table_b', value: 'table_b' },
      { label: 'table_c', value: 'table_c' },
      { label: 'table_d', value: 'table_d' },
    ]);
  });
});

test('table select retain value if not in SQL Lab mode', async () => {
  SupersetClientGet.mockImplementation(getTableMockFunction);

  const callback = jest.fn();
  const props = createProps({
    onTableSelectChange: callback,
    sqlLabMode: false,
  });

  render(<TableSelector {...props} />, { useRedux: true });

  const tableSelect = screen.getByRole('combobox', {
    name: 'Select table or type table name',
  });

  expect(screen.queryByText('table_a')).not.toBeInTheDocument();
  expect(getSelectItemContainer(tableSelect)).toHaveLength(0);

  userEvent.click(tableSelect);

  expect(
    await screen.findByRole('option', { name: 'table_a' }),
  ).toBeInTheDocument();

  act(() => {
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
  SupersetClientGet.mockImplementation(getTableMockFunction);

  const callback = jest.fn();
  const props = createProps({
    onTableSelectChange: callback,
  });

  render(<TableSelectorMultiple {...props} />, { useRedux: true });

  const tableSelect = screen.getByRole('combobox', {
    name: 'Select table or type table name',
  });

  expect(screen.queryByText('table_a')).not.toBeInTheDocument();
  expect(getSelectItemContainer(tableSelect)).toHaveLength(0);

  userEvent.click(tableSelect);

  expect(
    await screen.findByRole('option', { name: 'table_a' }),
  ).toBeInTheDocument();

  act(() => {
    const item = screen.getAllByText('table_a');
    userEvent.click(item[item.length - 1]);
  });

  act(() => {
    const item = screen.getAllByText('table_c');
    userEvent.click(item[item.length - 1]);
  });

  const selectedValueContainer = getSelectItemContainer(tableSelect);

  expect(selectedValueContainer).toHaveLength(2);
  expect(
    await within(selectedValueContainer?.[0] as HTMLElement).findByText(
      'table_a',
    ),
  ).toBeInTheDocument();
  expect(
    await within(selectedValueContainer?.[1] as HTMLElement).findByText(
      'table_c',
    ),
  ).toBeInTheDocument();
});
