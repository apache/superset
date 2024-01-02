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
import fetchMock from 'fetch-mock';
import * as uiCore from '@superset-ui/core';
import { FeatureFlag } from '@superset-ui/core';
import TableElement, { Column } from 'src/SqlLab/components/TableElement';
import { table, initialState } from 'src/SqlLab/fixtures';
import { render, waitFor, fireEvent } from 'spec/helpers/testing-library';

jest.mock('src/components/Loading', () => () => (
  <div data-test="mock-loading" />
));
jest.mock('src/components/IconTooltip', () => ({
  IconTooltip: ({
    onClick,
    tooltip,
  }: {
    onClick: () => void;
    tooltip: string;
  }) => (
    <button type="button" data-test="mock-icon-tooltip" onClick={onClick}>
      {tooltip}
    </button>
  ),
}));
jest.mock(
  'src/SqlLab/components/ColumnElement',
  () =>
    ({ column }: { column: Column }) =>
      <div data-test="mock-column-element">{column.name}</div>,
);
const getTableMetadataEndpoint = 'glob:**/api/v1/database/*/table/*/*/';
const getExtraTableMetadataEndpoint =
  'glob:**/api/v1/database/*/table_extra/*/*/';
const updateTableSchemaEndpoint = 'glob:*/tableschemaview/*/expanded';

beforeEach(() => {
  fetchMock.get(getTableMetadataEndpoint, table);
  fetchMock.get(getExtraTableMetadataEndpoint, {});
  fetchMock.post(updateTableSchemaEndpoint, {});
});

afterEach(() => {
  fetchMock.reset();
});

const mockedProps = {
  table: {
    ...table,
    initialized: true,
  },
};

test('renders', () => {
  expect(React.isValidElement(<TableElement table={table} />)).toBe(true);
});

test('renders with props', () => {
  expect(React.isValidElement(<TableElement {...mockedProps} />)).toBe(true);
});

test('has 4 IconTooltip elements', async () => {
  const { getAllByTestId } = render(<TableElement {...mockedProps} />, {
    useRedux: true,
    initialState,
  });
  await waitFor(() =>
    expect(getAllByTestId('mock-icon-tooltip')).toHaveLength(4),
  );
});

test('has 14 columns', async () => {
  const { getAllByTestId } = render(<TableElement {...mockedProps} />, {
    useRedux: true,
    initialState,
  });
  await waitFor(() =>
    expect(getAllByTestId('mock-column-element')).toHaveLength(14),
  );
});

test('fades table', async () => {
  const { getAllByTestId } = render(<TableElement {...mockedProps} />, {
    useRedux: true,
    initialState,
  });
  await waitFor(() =>
    expect(getAllByTestId('mock-icon-tooltip')).toHaveLength(4),
  );
  const style = window.getComputedStyle(getAllByTestId('fade')[0]);
  expect(style.opacity).toBe('0');
  fireEvent.mouseEnter(getAllByTestId('table-element-header-container')[0]);
  await waitFor(() =>
    expect(window.getComputedStyle(getAllByTestId('fade')[0]).opacity).toBe(
      '1',
    ),
  );
});

test('sorts columns', async () => {
  const { getAllByTestId, getByText } = render(
    <TableElement {...mockedProps} />,
    {
      useRedux: true,
      initialState,
    },
  );
  await waitFor(() =>
    expect(getAllByTestId('mock-icon-tooltip')).toHaveLength(4),
  );
  expect(
    getAllByTestId('mock-column-element').map(el => el.textContent),
  ).toEqual(table.columns.map(col => col.name));
  fireEvent.click(getByText('Sort columns alphabetically'));
  const sorted = [...table.columns.map(col => col.name)].sort();
  expect(
    getAllByTestId('mock-column-element').map(el => el.textContent),
  ).toEqual(sorted);
  expect(getAllByTestId('mock-column-element')[0]).toHaveTextContent('active');
});

test('removes the table', async () => {
  const updateTableSchemaEndpoint = 'glob:*/tableschemaview/*';
  fetchMock.delete(updateTableSchemaEndpoint, {});
  const isFeatureEnabledMock = jest
    .spyOn(uiCore, 'isFeatureEnabled')
    .mockImplementation(
      featureFlag => featureFlag === FeatureFlag.SQLLAB_BACKEND_PERSISTENCE,
    );
  const { getAllByTestId, getByText } = render(
    <TableElement {...mockedProps} />,
    {
      useRedux: true,
      initialState,
    },
  );
  await waitFor(() =>
    expect(getAllByTestId('mock-icon-tooltip')).toHaveLength(4),
  );
  expect(fetchMock.calls(updateTableSchemaEndpoint)).toHaveLength(0);
  fireEvent.click(getByText('Remove table preview'));
  await waitFor(() =>
    expect(fetchMock.calls(updateTableSchemaEndpoint)).toHaveLength(1),
  );
  isFeatureEnabledMock.mockClear();
});

test('fetches table metadata when expanded', async () => {
  render(<TableElement {...mockedProps} />, {
    useRedux: true,
    initialState,
  });
  expect(fetchMock.calls(getTableMetadataEndpoint)).toHaveLength(0);
  expect(fetchMock.calls(getExtraTableMetadataEndpoint)).toHaveLength(0);
  await waitFor(() =>
    expect(fetchMock.calls(getTableMetadataEndpoint)).toHaveLength(1),
  );
  expect(fetchMock.calls(updateTableSchemaEndpoint)).toHaveLength(0);
  expect(fetchMock.calls(getExtraTableMetadataEndpoint)).toHaveLength(1);
});
