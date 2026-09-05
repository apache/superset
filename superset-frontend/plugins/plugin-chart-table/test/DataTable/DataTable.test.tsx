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
import { Component, type ReactNode } from 'react';
import { act, render, screen } from '@superset-ui/core/spec';
import { CellProps, Column, HeaderProps } from 'react-table';
import DataTable from '../../src/DataTable/DataTable';
import { ProviderWrapper } from '../testHelpers';

// Lets the RAF-debounced emit effect in DataTable settle before asserting.
const flushRaf = () =>
  act(() => new Promise<void>(resolve => setTimeout(resolve, 50)));

type DataRow = {
  city: string;
  firstName: string;
};

interface RenderErrorBoundaryProps {
  children: ReactNode;
}

interface RenderErrorBoundaryState {
  hasError: boolean;
}

const columns: Column<DataRow>[] = [
  {
    Header: ({ column }: HeaderProps<DataRow>) => (
      <th data-column-name={column.id}>First name</th>
    ),
    Cell: ({ value }: CellProps<DataRow>) => <td>{value}</td>,
    id: 'firstName',
    accessor: 'firstName' as never,
  },
  {
    Header: ({ column }: HeaderProps<DataRow>) => (
      <th data-column-name={column.id}>City</th>
    ),
    Cell: ({ value }: CellProps<DataRow>) => <td>{value}</td>,
    id: 'city',
    accessor: 'city' as never,
  },
];

const data: DataRow[] = [
  { firstName: 'Michael', city: 'Paris' },
  { firstName: 'Jordan', city: 'London' },
];

// Turns a render-phase throw, such as a Rules of Hooks violation, into a
// readable assertion instead of an unhandled error.
class RenderErrorBoundary extends Component<
  RenderErrorBoundaryProps,
  RenderErrorBoundaryState
> {
  state: RenderErrorBoundaryState = {
    hasError: false,
  };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      // data-test is the configured testIdAttribute (see spec/helpers/setup.ts),
      // so *ByTestId('render-error') resolves this node.
      return <div data-test="render-error">Render error</div>;
    }

    return this.props.children;
  }
}

const renderDataTable = (
  tableColumns: Column<DataRow>[],
  onFilteredRowsChange: (rows: DataRow[]) => void = jest.fn(),
) => (
  <ProviderWrapper>
    <RenderErrorBoundary>
      <DataTable<DataRow>
        columns={tableColumns}
        data={data}
        rowCount={data.length}
        serverPagination={false}
        serverPaginationData={{}}
        onServerPaginationChange={jest.fn()}
        handleSortByChange={jest.fn()}
        sortByFromParent={[]}
        onSearchColChange={jest.fn()}
        searchOptions={[]}
        onFilteredRowsChange={onFilteredRowsChange}
        sticky={false}
      />
    </RenderErrorBoundary>
  </ProviderWrapper>
);

test('keeps the hook order stable when the columns disappear', () => {
  const { rerender } = render(renderDataTable(columns));

  expect(screen.getByText('Michael')).toBeInTheDocument();

  rerender(renderDataTable([]));

  expect(screen.queryByTestId('render-error')).not.toBeInTheDocument();
  expect(screen.getByText('No data found')).toBeInTheDocument();
});

test('keeps the hook order stable when the columns appear', () => {
  const { rerender } = render(renderDataTable([]));

  expect(screen.getByText('No data found')).toBeInTheDocument();

  rerender(renderDataTable(columns));

  expect(screen.queryByTestId('render-error')).not.toBeInTheDocument();
  expect(screen.getByText('Michael')).toBeInTheDocument();
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
