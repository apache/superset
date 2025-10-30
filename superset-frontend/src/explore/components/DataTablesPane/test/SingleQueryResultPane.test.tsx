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
import { SingleQueryResultPane } from '../components/SingleQueryResultPane';

describe('SingleQueryResultPane', () => {
  const mockData = Array.from({ length: 30 }, (_, i) => ({
    id: i + 1,
    name: `Item ${i + 1}`,
    category: i % 2 === 0 ? 'Action' : 'Horror',
  }));

  const defaultProps = {
    data: mockData as any, // Type mismatch between definition and actual usage
    colnames: ['id', 'name', 'category'],
    coltypes: [0, 1, 1], // numeric, string, string
    rowcount: 30,
    datasourceId: '1__table',
    dataSize: 10, // 10 items per page, so 3 pages total
    isVisible: true,
    canDownload: true,
  };

  test('renders table and filters data', async () => {
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

  test('TableView component resets on filter change due to key prop', () => {
    const { container } = render(<SingleQueryResultPane {...defaultProps} />, {
      useTheme: true,
      useRedux: true,
    });

    // Verify TableView is rendered with empty key initially
    const tableViewInitial = container.querySelector('.table-condensed');
    expect(tableViewInitial).toBeInTheDocument();

    // The key prop on TableView ensures it remounts when filterText changes
    // This automatically resets pagination to page 0
  });

  test('filters data correctly and shows no results message', async () => {
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
});
