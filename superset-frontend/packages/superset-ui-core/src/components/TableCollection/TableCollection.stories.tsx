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
import { useMemo, useState, useCallback } from 'react';
import { Meta, StoryFn } from '@storybook/react';
import {
  useTable,
  useSortBy,
  Column,
  Row,
  SortingRule,
  HeaderGroup,
  ColumnInstance,
  TablePropGetter,
  TableBodyPropGetter,
} from 'react-table';
import TableCollection from '.';
import { TableSize } from '../Table';

// Type aliases for casting to the component's expected object-based types
// Required because memo() loses the generic type parameter
type AnyProps = TablePropGetter<object>;
type AnyBodyProps = TableBodyPropGetter<object>;
type AnyHeaders = HeaderGroup<object>[];
type AnyRows = Row<object>[];
type AnyColumns = ColumnInstance<object>[];
type AnyPrepareRow = (row: Row<object>) => void;

export default {
  title: 'Components/TableCollection',
  component: TableCollection,
} as Meta<typeof TableCollection>;

// Sample data type
interface SampleData {
  id: number;
  name: string;
  email: string;
  role: string;
  status: string;
  lastLogin: string;
}

// Sample data generator
const generateSampleData = (count: number): SampleData[] =>
  Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    name: `User ${i + 1}`,
    email: `user${i + 1}@example.com`,
    role: ['Admin', 'Editor', 'Viewer'][i % 3],
    status: ['Active', 'Inactive', 'Pending'][i % 3],
    lastLogin: new Date(
      Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000,
    ).toLocaleDateString(),
  }));

// Basic table story
export const Basic: StoryFn = () => {
  const data = useMemo(() => generateSampleData(10), []);

  const columns: Column<SampleData>[] = useMemo(
    () => [
      { Header: 'ID', accessor: 'id' },
      { Header: 'Name', accessor: 'name' },
      { Header: 'Email', accessor: 'email' },
      { Header: 'Role', accessor: 'role' },
      { Header: 'Status', accessor: 'status' },
      { Header: 'Last Login', accessor: 'lastLogin' },
    ],
    [],
  );

  const {
    getTableProps,
    getTableBodyProps,
    headerGroups,
    rows,
    prepareRow,
    columns: tableColumns,
  } = useTable<SampleData>({ columns, data }, useSortBy);

  return (
    <TableCollection
      getTableProps={getTableProps as AnyProps}
      getTableBodyProps={getTableBodyProps as AnyBodyProps}
      headerGroups={headerGroups as AnyHeaders}
      rows={rows as AnyRows}
      columns={tableColumns as AnyColumns}
      prepareRow={prepareRow as AnyPrepareRow}
      loading={false}
      totalCount={rows.length}
      pageSize={10}
    />
  );
};

Basic.parameters = {
  docs: {
    description: {
      story:
        'Basic TableCollection with sortable columns. Click column headers to sort.',
    },
  },
};

// With pagination
export const WithPagination: StoryFn = () => {
  const allData = useMemo(() => generateSampleData(50), []);
  const [pageIndex, setPageIndex] = useState(0);
  const pageSize = 10;

  const paginatedData = useMemo(
    () => allData.slice(pageIndex * pageSize, (pageIndex + 1) * pageSize),
    [allData, pageIndex],
  );

  const columns: Column<SampleData>[] = useMemo(
    () => [
      { Header: 'ID', accessor: 'id' },
      { Header: 'Name', accessor: 'name' },
      { Header: 'Email', accessor: 'email' },
      { Header: 'Role', accessor: 'role' },
      { Header: 'Status', accessor: 'status' },
    ],
    [],
  );

  const {
    getTableProps,
    getTableBodyProps,
    headerGroups,
    rows,
    prepareRow,
    columns: tableColumns,
  } = useTable<SampleData>({ columns, data: paginatedData }, useSortBy);

  const handlePageChange = useCallback((page: number) => {
    setPageIndex(page);
  }, []);

  return (
    <TableCollection
      getTableProps={getTableProps as AnyProps}
      getTableBodyProps={getTableBodyProps as AnyBodyProps}
      headerGroups={headerGroups as AnyHeaders}
      rows={rows as AnyRows}
      columns={tableColumns as AnyColumns}
      prepareRow={prepareRow as AnyPrepareRow}
      loading={false}
      pageIndex={pageIndex}
      pageSize={pageSize}
      totalCount={allData.length}
      onPageChange={handlePageChange}
      showRowCount
    />
  );
};

WithPagination.parameters = {
  docs: {
    description: {
      story:
        'TableCollection with server-side pagination. Shows "X-Y of Z" row count.',
    },
  },
};

// With row selection
export const WithRowSelection: StoryFn = () => {
  const data = useMemo(() => generateSampleData(10), []);
  const [selectedRows, setSelectedRows] = useState<Row<SampleData>[]>([]);

  const columns: Column<SampleData>[] = useMemo(
    () => [
      { Header: 'ID', accessor: 'id' },
      { Header: 'Name', accessor: 'name' },
      { Header: 'Email', accessor: 'email' },
      { Header: 'Role', accessor: 'role' },
    ],
    [],
  );

  const {
    getTableProps,
    getTableBodyProps,
    headerGroups,
    rows,
    prepareRow,
    columns: tableColumns,
  } = useTable<SampleData>({ columns, data }, useSortBy);

  const toggleRowSelected = useCallback(
    (rowId: string, selected: boolean) => {
      const row = rows.find(r => r.id === rowId);
      if (row) {
        if (selected) {
          setSelectedRows(prev => [...prev, row] as Row<SampleData>[]);
        } else {
          setSelectedRows(
            prev => prev.filter(r => r.id !== rowId) as Row<SampleData>[],
          );
        }
      }
    },
    [rows],
  );

  const toggleAllRowsSelected = useCallback(
    (selected?: boolean) => {
      if (selected) {
        setSelectedRows(rows as Row<SampleData>[]);
      } else {
        setSelectedRows([]);
      }
    },
    [rows],
  );

  return (
    <div>
      <div style={{ marginBottom: 16, color: '#666' }}>
        Selected: {selectedRows.length} row(s)
        {selectedRows.length > 0 && (
          <span> - IDs: {selectedRows.map(r => r.original.id).join(', ')}</span>
        )}
      </div>
      <TableCollection
        getTableProps={getTableProps as AnyProps}
        getTableBodyProps={getTableBodyProps as AnyBodyProps}
        headerGroups={headerGroups as AnyHeaders}
        rows={rows as AnyRows}
        columns={tableColumns as AnyColumns}
        prepareRow={prepareRow as AnyPrepareRow}
        loading={false}
        bulkSelectEnabled
        selectedFlatRows={selectedRows as AnyRows}
        toggleRowSelected={toggleRowSelected}
        toggleAllRowsSelected={toggleAllRowsSelected}
        totalCount={rows.length}
        pageSize={10}
      />
    </div>
  );
};

WithRowSelection.parameters = {
  docs: {
    description: {
      story:
        'TableCollection with bulk selection enabled. Use checkboxes to select individual rows or all rows.',
    },
  },
};

// Loading state
export const LoadingState: StoryFn = () => {
  const data: SampleData[] = useMemo(() => [], []);

  const columns: Column<SampleData>[] = useMemo(
    () => [
      { Header: 'ID', accessor: 'id' },
      { Header: 'Name', accessor: 'name' },
      { Header: 'Email', accessor: 'email' },
      { Header: 'Role', accessor: 'role' },
      { Header: 'Status', accessor: 'status' },
    ],
    [],
  );

  const {
    getTableProps,
    getTableBodyProps,
    headerGroups,
    rows,
    prepareRow,
    columns: tableColumns,
  } = useTable<SampleData>({ columns, data }, useSortBy);

  return (
    <TableCollection
      getTableProps={getTableProps as AnyProps}
      getTableBodyProps={getTableBodyProps as AnyBodyProps}
      headerGroups={headerGroups as AnyHeaders}
      rows={rows as AnyRows}
      columns={tableColumns as AnyColumns}
      prepareRow={prepareRow as AnyPrepareRow}
      loading
      totalCount={0}
      pageSize={10}
    />
  );
};

LoadingState.parameters = {
  docs: {
    description: {
      story: 'TableCollection in loading state with a spinner overlay.',
    },
  },
};

// Different sizes
export const TableSizes: StoryFn = () => {
  const data = useMemo(() => generateSampleData(5), []);

  const columns: Column<SampleData>[] = useMemo(
    () => [
      { Header: 'ID', accessor: 'id' },
      { Header: 'Name', accessor: 'name' },
      { Header: 'Email', accessor: 'email' },
      { Header: 'Role', accessor: 'role' },
    ],
    [],
  );

  const sizes: TableSize[] = [
    TableSize.Small,
    TableSize.Middle,
    TableSize.Large,
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
      {sizes.map(size => {
        const {
          getTableProps,
          getTableBodyProps,
          headerGroups,
          rows,
          prepareRow,
          columns: tableColumns,
        } = useTable<SampleData>({ columns, data }, useSortBy);

        return (
          <div key={size}>
            <h4 style={{ marginBottom: 8 }}>Size: {size}</h4>
            <TableCollection
              getTableProps={getTableProps as AnyProps}
              getTableBodyProps={getTableBodyProps as AnyBodyProps}
              headerGroups={headerGroups as AnyHeaders}
              rows={rows as AnyRows}
              columns={tableColumns as AnyColumns}
              prepareRow={prepareRow as AnyPrepareRow}
              loading={false}
              size={size}
              totalCount={rows.length}
              pageSize={10}
            />
          </div>
        );
      })}
    </div>
  );
};

TableSizes.parameters = {
  docs: {
    description: {
      story: 'TableCollection in different sizes: small, middle, and large.',
    },
  },
};

// With controlled sorting
export const WithControlledSorting: StoryFn = () => {
  const [sortBy, setSortBy] = useState<SortingRule<SampleData>[]>([
    { id: 'name', desc: false },
  ]);

  const data = useMemo(() => {
    const rawData = generateSampleData(15);
    if (sortBy.length > 0) {
      const { id, desc } = sortBy[0];
      return [...rawData].sort((a, b) => {
        const aVal = a[id as keyof SampleData];
        const bVal = b[id as keyof SampleData];
        if (aVal < bVal) return desc ? 1 : -1;
        if (aVal > bVal) return desc ? -1 : 1;
        return 0;
      });
    }
    return rawData;
  }, [sortBy]);

  const columns: Column<SampleData>[] = useMemo(
    () => [
      { Header: 'ID', accessor: 'id' },
      { Header: 'Name', accessor: 'name' },
      { Header: 'Email', accessor: 'email' },
      { Header: 'Role', accessor: 'role' },
      { Header: 'Status', accessor: 'status' },
    ],
    [],
  );

  const {
    getTableProps,
    getTableBodyProps,
    headerGroups,
    rows,
    prepareRow,
    columns: tableColumns,
  } = useTable<SampleData>(
    {
      columns,
      data,
      initialState: { sortBy },
      manualSortBy: true,
    },
    useSortBy,
  );

  return (
    <div>
      <div style={{ marginBottom: 16, color: '#666' }}>
        Current sort:{' '}
        {sortBy.length > 0
          ? `${sortBy[0].id} (${sortBy[0].desc ? 'descending' : 'ascending'})`
          : 'none'}
      </div>
      <TableCollection
        getTableProps={getTableProps as AnyProps}
        getTableBodyProps={getTableBodyProps as AnyBodyProps}
        headerGroups={headerGroups as AnyHeaders}
        rows={rows as AnyRows}
        columns={tableColumns as AnyColumns}
        prepareRow={prepareRow as AnyPrepareRow}
        loading={false}
        setSortBy={setSortBy}
        totalCount={rows.length}
        pageSize={15}
      />
    </div>
  );
};

WithControlledSorting.parameters = {
  docs: {
    description: {
      story:
        'TableCollection with controlled (server-side) sorting. Click column headers to sort.',
    },
  },
};

// With row highlighting
export const WithRowHighlighting: StoryFn = () => {
  const data = useMemo(() => generateSampleData(10), []);
  const [highlightRowId, setHighlightRowId] = useState<number | undefined>(3);

  const columns: Column<SampleData>[] = useMemo(
    () => [
      { Header: 'ID', accessor: 'id' },
      { Header: 'Name', accessor: 'name' },
      { Header: 'Email', accessor: 'email' },
      { Header: 'Role', accessor: 'role' },
    ],
    [],
  );

  const {
    getTableProps,
    getTableBodyProps,
    headerGroups,
    rows,
    prepareRow,
    columns: tableColumns,
  } = useTable<SampleData>({ columns, data }, useSortBy);

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <label>
          Highlight row ID:{' '}
          <select
            value={highlightRowId ?? ''}
            onChange={e =>
              setHighlightRowId(
                e.target.value ? Number(e.target.value) : undefined,
              )
            }
          >
            <option value="">None</option>
            {data.map(d => (
              <option key={d.id} value={d.id}>
                {d.id}
              </option>
            ))}
          </select>
        </label>
      </div>
      <TableCollection
        getTableProps={getTableProps as AnyProps}
        getTableBodyProps={getTableBodyProps as AnyBodyProps}
        headerGroups={headerGroups as AnyHeaders}
        rows={rows as AnyRows}
        columns={tableColumns as AnyColumns}
        prepareRow={prepareRow as AnyPrepareRow}
        loading={false}
        highlightRowId={highlightRowId}
        totalCount={rows.length}
        pageSize={10}
      />
    </div>
  );
};

WithRowHighlighting.parameters = {
  docs: {
    description: {
      story:
        'TableCollection with row highlighting. Use the dropdown to highlight a specific row.',
    },
  },
};
