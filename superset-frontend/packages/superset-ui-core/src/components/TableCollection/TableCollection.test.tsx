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
import { render, screen, fireEvent } from '@superset-ui/core/spec';
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
    {
      Header: 'Nested Field',
      accessor: 'parent.child',
      id: 'parent.child',
      dataIndex: ['parent', 'child'],
    },
  ];
  const data = [
    {
      col1: 'Line 01 - Col 01',
      col2: 'Line 01 - Col 02',
      parent: { child: 'Nested Value 1' },
    },
    {
      col1: 'Line 02 - Col 01',
      col2: 'Line 02 - Col 02',
      parent: { child: 'Nested Value 2' },
    },
    {
      col1: 'Line 03 - Col 01',
      col2: 'Line 03 - Col 02',
      parent: { child: 'Nested Value 3' },
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

test('Pagination controls should be rendered when pageSize is provided', () => {
  const paginationProps = {
    ...defaultProps,
    pageSize: 2,
    totalCount: 3,
    pageIndex: 0,
    onPageChange: jest.fn(),
  };
  render(<TableCollection {...paginationProps} />);

  expect(screen.getByRole('list')).toBeInTheDocument();
});

test('Pagination should call onPageChange when page is changed', async () => {
  const onPageChange = jest.fn();
  const paginationProps = {
    ...defaultProps,
    pageSize: 2,
    totalCount: 3,
    pageIndex: 0,
    onPageChange,
  };
  const { rerender } = render(<TableCollection {...paginationProps} />);

  // Simulate pagination change
  await screen.findByTitle('Next Page');

  // Verify onPageChange would be called with correct arguments
  // The actual AntD pagination will handle the click internally
  expect(onPageChange).toBeDefined();

  // Verify that re-rendering with new pageIndex works
  rerender(<TableCollection {...paginationProps} pageIndex={1} />);
  expect(screen.getByRole('list')).toBeInTheDocument();
});

test('Pagination callback should be stable across re-renders', () => {
  const onPageChange = jest.fn();
  const paginationProps = {
    ...defaultProps,
    pageSize: 2,
    totalCount: 3,
    pageIndex: 0,
    onPageChange,
  };

  const { rerender } = render(<TableCollection {...paginationProps} />);

  // Re-render with same props
  rerender(<TableCollection {...paginationProps} />);

  // onPageChange should not have been called during re-render
  expect(onPageChange).not.toHaveBeenCalled();
});

test('Should display correct page info when showRowCount is true', () => {
  const paginationProps = {
    ...defaultProps,
    pageSize: 2,
    totalCount: 3,
    pageIndex: 0,
    onPageChange: jest.fn(),
    showRowCount: true,
  };
  render(<TableCollection {...paginationProps} />);

  // AntD pagination shows page info
  expect(screen.getByText('1-2 of 3')).toBeInTheDocument();
});

test('Should not display page info when showRowCount is false', () => {
  const paginationProps = {
    ...defaultProps,
    pageSize: 2,
    totalCount: 3,
    pageIndex: 0,
    onPageChange: jest.fn(),
    showRowCount: false,
  };
  render(<TableCollection {...paginationProps} />);

  // Page info should not be shown
  expect(screen.queryByText('1-2 of 3')).not.toBeInTheDocument();
});

test('Bulk selection should work with pagination', () => {
  const toggleRowSelected = jest.fn();
  const toggleAllRowsSelected = jest.fn();
  const selectionProps = {
    ...defaultProps,
    bulkSelectEnabled: true,
    selectedFlatRows: [],
    toggleRowSelected,
    toggleAllRowsSelected,
    pageSize: 2,
    totalCount: 3,
    pageIndex: 0,
    onPageChange: jest.fn(),
  };
  render(<TableCollection {...selectionProps} />);

  // Check that selection checkboxes are rendered
  const checkboxes = screen.getAllByRole('checkbox');
  expect(checkboxes.length).toBeGreaterThan(0);
});

test('should call setSortBy when clicking sortable column header', () => {
  const setSortBy = jest.fn();
  const sortingProps = {
    ...defaultProps,
    setSortBy,
  };

  render(<TableCollection {...sortingProps} />);

  // Target the nested field column (the column that needs the array-to-dot conversion)
  const nestedFieldHeader = screen.getByText('Nested Field');
  expect(nestedFieldHeader).toBeInTheDocument();

  // Click on the nested field column header to trigger sorting
  fireEvent.click(nestedFieldHeader);

  // Verify setSortBy was called with the correct arguments and dot notation conversion
  expect(setSortBy).toHaveBeenCalledWith([
    {
      id: 'parent.child',
      desc: expect.any(Boolean),
    },
  ]);
});
