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
import { render, screen } from '@superset-ui/core/spec';
import { renderHook } from '@testing-library/react-hooks';
import { TableInstance, useTable } from 'react-table';
import TableCollection from '.';

let defaultProps: any;

let tableHook: TableInstance<any>;
beforeEach(() => {
  const columns = [
    {
      Header: 'Column 1',
      accessor: 'col1',
      id: 'col1',
    },
    {
      Header: 'Column 2',
      accessor: 'col2',
      id: 'col2',
    },
  ];
  const data = [
    {
      col1: 'Line 01 - Col 01',
      col2: 'Line 01 - Col 02',
    },
    {
      col1: 'Line 02 - Col 01',
      col2: 'Line 02 - Col 02',
    },
    {
      col1: 'Line 03 - Col 01',
      col2: 'Line 03 - Col 02',
    },
  ];
  // @ts-ignore
  const tableHookResult = renderHook(() => useTable({ columns, data }));
  tableHook = tableHookResult.result.current;
  defaultProps = {
    prepareRow: tableHook.prepareRow,
    headerGroups: tableHook.headerGroups,
    rows: tableHook.rows,
    columns: tableHook.columns,
    loading: false,
    highlightRowId: 1,
    getTableProps: jest.fn(),
    getTableBodyProps: jest.fn(),
    sticky: false,
  };
});

test('Headers should be visible', () => {
  render(<TableCollection {...defaultProps} />);

  expect(screen.getByText('Column 1')).toBeVisible();
  expect(screen.getByText('Column 2')).toBeVisible();
});

test('Body should be visible', () => {
  render(<TableCollection {...defaultProps} />);

  expect(screen.getByText('Line 01 - Col 01')).toBeVisible();
  expect(screen.getByText('Line 01 - Col 02')).toBeVisible();

  expect(screen.getByText('Line 02 - Col 01')).toBeVisible();
  expect(screen.getByText('Line 02 - Col 02')).toBeVisible();

  expect(screen.getByText('Line 03 - Col 01')).toBeVisible();
  expect(screen.getByText('Line 03 - Col 02')).toBeVisible();
});

test('Body content should be blurred loading', () => {
  render(<TableCollection {...defaultProps} loading />);

  expect(screen.getByTestId('listview-table').parentNode).toHaveClass(
    'ant-spin-blur',
  );
});

test('Should the loading-indicator be visible during loading', () => {
  render(<TableCollection {...defaultProps} loading />);

  expect(screen.getByTestId('loading-indicator')).toBeVisible();
});
