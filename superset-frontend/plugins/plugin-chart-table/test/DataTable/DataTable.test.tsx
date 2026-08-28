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
import { Column } from 'react-table';
import { render, screen } from '@superset-ui/core/spec';
import DataTable from '../../src/DataTable/DataTable';
import { ProviderWrapper } from '../testHelpers';

type Datum = { name: string };

// Header/Cell render the full <th>/<td> like TableChart's column definitions
const columns: Column<Datum>[] = [
  {
    accessor: 'name',
    Header: () => <th>Name</th>,
    Cell: ({ value }: { value: string }) => <td>{value}</td>,
  },
];
const data: Datum[] = [{ name: 'Michael' }, { name: 'Joe' }, { name: 'Maria' }];

const mockedProps = {
  columns,
  data,
  pageSize: 1,
  searchInput: false,
  rowCount: data.length,
  serverPaginationData: {},
  onServerPaginationChange: jest.fn(),
  handleSortByChange: jest.fn(),
  sortByFromParent: [],
  onSearchColChange: jest.fn(),
  searchOptions: [],
  noResults: 'No records found',
  // disable react-table's post-commit auto page reset so these tests
  // exercise the render-time clamp in isolation
  autoResetPage: false,
};

describe('DataTable pagination clamp (#31403)', () => {
  test('clamps pageIndex to the last page when it exceeds pageCount', () => {
    render(
      <ProviderWrapper>
        <DataTable<Datum> {...mockedProps} initialState={{ pageIndex: 5 }} />
      </ProviderWrapper>,
    );
    // 3 rows at pageSize 1 => 3 pages; index 5 is out of range and must be
    // clamped to the last page instead of rendering an empty page
    expect(screen.getByText('Maria')).toBeInTheDocument();
    expect(screen.queryByText('No records found')).not.toBeInTheDocument();
  });

  test('resets pageIndex to 0 when data becomes empty (pageCount === 0)', () => {
    const { rerender } = render(
      <ProviderWrapper>
        <DataTable<Datum>
          {...mockedProps}
          data={[]}
          initialState={{ pageIndex: 5 }}
        />
      </ProviderWrapper>,
    );
    // zero rows => pageCount === 0; the empty state renders without errors
    expect(screen.getByText('No records found')).toBeInTheDocument();

    // pageIndex was reset to 0, so restoring data lands on the first page
    // rather than resuming from the stale index
    rerender(
      <ProviderWrapper>
        <DataTable<Datum> {...mockedProps} />
      </ProviderWrapper>,
    );
    expect(screen.getByText('Michael')).toBeInTheDocument();
  });
});
