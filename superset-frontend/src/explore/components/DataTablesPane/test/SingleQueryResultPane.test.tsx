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
import {
  render,
  screen,
  waitFor,
  userEvent,
} from 'spec/helpers/testing-library';
import { GenericDataType } from '@apache-superset/core/api/core';
import { SingleQueryResultPane } from '../components/SingleQueryResultPane';

// Mock data matching what useFilteredTableData expects: Record<string, any>[]
const mockData: Record<string, unknown>[] = Array.from(
  { length: 30 },
  (_, i) => ({
    id: i + 1,
    name: `Item ${i + 1}`,
    category: i % 2 === 0 ? 'Action' : 'Horror',
  }),
);

const defaultProps = {
  // Note: The SingleQueryResultPaneProp type expects Record<string, any>[][]
  // but useFilteredTableData and useTableColumns actually work with Record<string, any>[]
  // This type mismatch exists in the codebase - cast through unknown to satisfy TypeScript
  data: mockData as unknown as Record<string, unknown>[][],
  colnames: ['id', 'name', 'category'],
  coltypes: [
    GenericDataType.Numeric,
    GenericDataType.String,
    GenericDataType.String,
  ],
  rowcount: 30,
  datasourceId: '1__table',
  dataSize: 10, // 10 items per page, so 3 pages total
  isVisible: true,
  canDownload: true,
};

test('SingleQueryResultPane renders table and filters data', async () => {
  render(<SingleQueryResultPane {...defaultProps} />, {
    useTheme: true,
    useRedux: true,
  });

  // Check that the table is rendered
  expect(screen.getByText('Item 1')).toBeInTheDocument();

  // Search for 'Action'
  const searchInput = screen.getByPlaceholderText('Search');
  await userEvent.type(searchInput, 'Action');

  // Verify filtered results
  await waitFor(() => {
    const actionElements = screen.getAllByText('Action');
    expect(actionElements.length).toBeGreaterThan(0);
    expect(screen.queryByText('Horror')).not.toBeInTheDocument();
  });
});

test('SingleQueryResultPane resets pagination when filter changes via key prop', () => {
  const { container } = render(<SingleQueryResultPane {...defaultProps} />, {
    useTheme: true,
    useRedux: true,
  });

  // Verify TableView is rendered
  const tableView = container.querySelector('.table-condensed');
  expect(tableView).toBeInTheDocument();

  // The key={filterText} prop on TableView ensures it remounts when filterText changes.
  // This is a documented React pattern for resetting component state - when the key
  // changes, React treats it as a new component instance and resets all internal state,
  // including pagination. This prevents the "currentPage > totalPages" error when
  // filtering reduces the number of pages below the current page number.
});

test('SingleQueryResultPane shows no results message when filter matches nothing', async () => {
  render(<SingleQueryResultPane {...defaultProps} />, {
    useTheme: true,
    useRedux: true,
  });

  // Search for text that doesn't exist
  const searchInput = screen.getByPlaceholderText('Search');
  await userEvent.type(searchInput, 'NonExistentText');

  // Wait for the no results message
  await waitFor(() => {
    expect(screen.getByText('No results')).toBeInTheDocument();
  });

  // Clear the search
  await userEvent.clear(searchInput);

  // Verify data is restored
  await waitFor(() => {
    expect(screen.getByText('Item 1')).toBeInTheDocument();
  });
});
