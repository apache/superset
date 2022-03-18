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
import { render, screen } from 'spec/helpers/testing-library';
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
    },
    {
      Header: 'Column 2',
      accessor: 'col2',
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
  };
});

test('Should headers visible', () => {
  render(<TableCollection {...defaultProps} />);

  expect(screen.getByRole('columnheader', { name: 'Column 1' })).toBeVisible();
  expect(screen.getByRole('columnheader', { name: 'Column 2' })).toBeVisible();
});

test('Should the body visible', () => {
  render(<TableCollection {...defaultProps} />);

  expect(screen.getByText('Line 01 - Col 01')).toBeVisible();
  expect(screen.getByText('Line 01 - Col 02')).toBeVisible();

  expect(screen.getByText('Line 02 - Col 01')).toBeVisible();
  expect(screen.getByText('Line 02 - Col 02')).toBeVisible();

  expect(screen.getByText('Line 03 - Col 01')).toBeVisible();
  expect(screen.getByText('Line 03 - Col 02')).toBeVisible();
});

test('Should the body content not be visible during loading', () => {
  render(<TableCollection {...defaultProps} loading />);

  expect(screen.getByText('Line 01 - Col 01')).toBeInTheDocument();
  expect(screen.getByText('Line 01 - Col 01')).not.toBeVisible();
  expect(screen.getByText('Line 01 - Col 02')).toBeInTheDocument();
  expect(screen.getByText('Line 01 - Col 02')).not.toBeVisible();

  expect(screen.getByText('Line 02 - Col 01')).toBeInTheDocument();
  expect(screen.getByText('Line 02 - Col 01')).not.toBeVisible();
  expect(screen.getByText('Line 02 - Col 02')).toBeInTheDocument();
  expect(screen.getByText('Line 02 - Col 02')).not.toBeVisible();

  expect(screen.getByText('Line 03 - Col 01')).toBeInTheDocument();
  expect(screen.getByText('Line 03 - Col 01')).not.toBeVisible();
  expect(screen.getByText('Line 03 - Col 02')).toBeInTheDocument();
  expect(screen.getByText('Line 03 - Col 02')).not.toBeVisible();
});

test('Should the loading bar be visible during loading', () => {
  render(<TableCollection {...defaultProps} loading />);

  expect(screen.getAllByRole('progressbar')).toHaveLength(6);
  screen
    .getAllByRole('progressbar')
    .forEach(progressbar => expect(progressbar).toBeVisible());
});
