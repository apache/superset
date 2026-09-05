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
import '@testing-library/jest-dom';
import { act } from 'react-dom/test-utils';
import { render, screen } from '@superset-ui/core/spec';
import { CellProps, Column, HeaderProps } from 'react-table';
import DataTable from '../../src/DataTable/DataTable';
import { ProviderWrapper } from '../testHelpers';

const flushRaf = () => act(() => new Promise(resolve => setTimeout(resolve, 20)));

type DataRow = {
  city: string;
  firstName: string;
};

const data: DataRow[] = [
  { firstName: 'Michael', city: 'Paris' },
  { firstName: 'Jordan', city: 'London' },
];

const populatedColumns = (): Column<DataRow>[] => [
  {
    Header: ({ column }: HeaderProps<DataRow>) => (
      <th data-column-name={column.id}>First name</th>
    ),
    Cell: ({ value }: CellProps<DataRow>) => <td>{value}</td>,
    accessor: 'firstName',
  },
  {
    Header: ({ column }: HeaderProps<DataRow>) => (
      <th data-column-name={column.id}>City</th>
    ),
    Cell: ({ value }: CellProps<DataRow>) => <td>{value}</td>,
    accessor: 'city',
  },
];

const renderDataTable = (
  columns: Column<DataRow>[],
  onFilteredRowsChange: (rows: DataRow[]) => void,
) => (
  <ProviderWrapper>
    <DataTable<DataRow>
      columns={columns}
      data={data}
      rowCount={data.length}
      serverPagination={false}
      serverPaginationData={{}}
      onServerPaginationChange={jest.fn()}
      handleSortByChange={jest.fn()}
      sortByFromParent={[]}
      onSearchColChange={jest.fn()}
      searchOptions={[]}
      sticky={false}
      onFilteredRowsChange={onFilteredRowsChange}
    />
  </ProviderWrapper>
);

// The "no columns" early return used to sit above five hooks, so crossing the
// zero-column boundary in either direction changed the hook count and React
// threw ("Rendered more/fewer hooks than during the previous render").
test('does not crash when the column count grows from zero (#42978)', () => {
  const onFilteredRowsChange = jest.fn();
  const { rerender } = render(renderDataTable([], onFilteredRowsChange));

  expect(screen.getByText('No data found')).toBeInTheDocument();

  expect(() =>
    rerender(renderDataTable(populatedColumns(), onFilteredRowsChange)),
  ).not.toThrow();

  expect(screen.getByText('Michael')).toBeInTheDocument();
  expect(screen.getByText('Paris')).toBeInTheDocument();
});

test('does not crash when the column count drops to zero (#42978)', () => {
  const onFilteredRowsChange = jest.fn();
  const { rerender } = render(
    renderDataTable(populatedColumns(), onFilteredRowsChange),
  );

  expect(screen.getByText('Michael')).toBeInTheDocument();

  expect(() =>
    rerender(renderDataTable([], onFilteredRowsChange)),
  ).not.toThrow();

  expect(screen.getByText('No data found')).toBeInTheDocument();
});

// The client-side emit effect used to run its signature check unconditionally,
// so a zero-column render still queued an onFilteredRowsChange call once rows
// changed. Columns being hidden doesn't change the underlying data, so nothing
// should be emitted for it.
test('does not emit filtered rows while the column count is zero', async () => {
  const onFilteredRowsChange = jest.fn();
  render(renderDataTable([], onFilteredRowsChange));

  await flushRaf();

  expect(onFilteredRowsChange).not.toHaveBeenCalled();
});
