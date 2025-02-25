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
import thunk from 'redux-thunk';
import configureStore from 'redux-mock-store';
import { QueryObject } from 'src/views/CRUD/types';
import { QueryState } from '@superset-ui/core';
import {
  render,
  screen,
  fireEvent,
  waitFor,
  within,
} from 'spec/helpers/testing-library';
import QueryPreviewModal from './QueryPreviewModal';

// store needed for withToasts
const mockStore = configureStore([thunk]);
const store = mockStore({});

const mockQueries: QueryObject[] = [...new Array(3)].map((_, i) => ({
  changed_on: new Date().toISOString(),
  id: i,
  slice_name: `cool chart ${i}`,
  database: {
    database_name: 'main db',
  },
  schema: 'public',
  sql: `SELECT ${i} FROM table`,
  executed_sql: `SELECT ${i} FROM table LIMIT 1000`,
  sql_tables: [
    { schema: 'foo', table: 'table' },
    { schema: 'bar', table: 'table_2' },
  ],
  status: QueryState.Success,
  tab_name: 'Main Tab',
  user: {
    first_name: 'cool',
    last_name: 'dude',
    id: 2,
    username: 'cooldude',
  },
  start_time: new Date().valueOf(),
  end_time: new Date().valueOf(),
  rows: 200,
  tmp_table_name: '',
  tracking_url: '',
}));

describe('QueryPreviewModal', () => {
  const mockedProps = {
    onHide: jest.fn(),
    openInSqlLab: jest.fn(),
    queries: mockQueries,
    query: mockQueries[0],
    fetchData: jest.fn((index: number) => {
      mockedProps.query = mockQueries[index];
    }),
    show: true,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  const getSqlContent = () => {
    // Find the container div that wraps the SyntaxHighlighter
    const container = screen.getByTestId('Query preview-modal');
    // Get all text content, which will include the SQL regardless of syntax highlighting
    return container.textContent;
  };

  it('renders a SyntaxHighlighter with initial SQL', async () => {
    render(<QueryPreviewModal {...mockedProps} />, {
      useRedux: true,
      store,
    });

    expect(getSqlContent()).toMatch(/SELECT 0 FROM table/i);
  });

  it('toggles between user sql and executed sql', async () => {
    render(<QueryPreviewModal {...mockedProps} />, {
      useRedux: true,
      store,
    });

    // Initial state shows user SQL
    expect(getSqlContent()).toMatch(/SELECT 0 FROM table/i);

    // Click executed SQL tab
    const executedTab = screen.getByRole('button', { name: 'Executed query' });
    fireEvent.click(executedTab);

    // Should show executed SQL
    await waitFor(() => {
      expect(getSqlContent()).toMatch(/SELECT 0 FROM table LIMIT 1000/i);
    });
  });

  describe('Previous button', () => {
    it('is disabled when query is the first in list', () => {
      render(<QueryPreviewModal {...mockedProps} />, {
        useRedux: true,
        store,
      });

      const prevButton = screen.getByRole('button', { name: 'Previous' });
      expect(prevButton).toBeDisabled();
    });

    it('calls fetchData with previous index', async () => {
      render(<QueryPreviewModal {...mockedProps} query={mockQueries[1]} />, {
        useRedux: true,
        store,
      });

      const prevButton = screen.getByRole('button', { name: 'Previous' });
      fireEvent.click(prevButton);

      expect(mockedProps.fetchData).toHaveBeenCalledWith(0);
    });
  });

  describe('Next button', () => {
    it('calls fetchData with next index', async () => {
      render(<QueryPreviewModal {...mockedProps} />, {
        useRedux: true,
        store,
      });

      const nextButton = screen.getByRole('button', { name: 'Next' });
      fireEvent.click(nextButton);

      expect(mockedProps.fetchData).toHaveBeenCalledWith(1);
    });

    it('is disabled when query is last in list', () => {
      render(<QueryPreviewModal {...mockedProps} query={mockQueries[2]} />, {
        useRedux: true,
        store,
      });

      const nextButton = screen.getByRole('button', { name: 'Next' });
      expect(nextButton).toBeDisabled();
    });
  });

  describe('Open in SQL Lab button', () => {
    it('calls openInSqlLab prop', async () => {
      const { query } = mockedProps;
      render(<QueryPreviewModal {...mockedProps} />, {
        useRedux: true,
        store,
      });

      const openButton = screen.getByRole('button', {
        name: 'Open in SQL Lab',
      });
      fireEvent.click(openButton);

      expect(mockedProps.openInSqlLab).toHaveBeenCalledWith(query.id);
    });
  });
});
