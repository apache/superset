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
import fetchMock from 'fetch-mock';
import {
  render,
  screen,
  fireEvent,
  waitFor,
} from 'spec/helpers/testing-library';
import { MemoryRouter } from 'react-router-dom';
import { QueryParamProvider } from 'use-query-params';
import SavedQueryList from '.';

// Increase default timeout
jest.setTimeout(30000);

const mockQueries = [...new Array(3)].map((_, i) => ({
  created_by: { id: i, first_name: 'user', last_name: `${i}` },
  created_on: `${i}-2020`,
  database: { database_name: `db ${i}`, id: i },
  changed_on_delta_humanized: '1 day ago',
  db_id: i,
  description: `SQL for ${i}`,
  id: i,
  label: `query ${i}`,
  schema: 'public',
  sql: `SELECT ${i} FROM table`,
  sql_tables: [{ catalog: null, schema: null, table: `${i}` }],
  tags: [],
}));

const mockUser = {
  userId: 1,
  firstName: 'admin',
  lastName: 'admin',
};

const queriesInfoEndpoint = 'glob:*/api/v1/saved_query/_info*';
const queriesEndpoint = 'glob:*/api/v1/saved_query/?*';
const queryEndpoint = 'glob:*/api/v1/saved_query/*';
const permalinkEndpoint = 'glob:*/api/v1/sqllab/permalink';

fetchMock.get(queriesInfoEndpoint, {
  permissions: ['can_write', 'can_read', 'can_export'],
});

fetchMock.get(queriesEndpoint, {
  ids: [2, 0, 1],
  result: mockQueries,
  count: mockQueries.length,
});

fetchMock.post(permalinkEndpoint, {
  url: 'http://localhost/permalink',
});

fetchMock.delete(queryEndpoint, {});

const renderList = (props = {}, storeOverrides = {}) =>
  render(
    <MemoryRouter>
      <QueryParamProvider>
        <SavedQueryList user={mockUser} {...props} />
      </QueryParamProvider>
    </MemoryRouter>,
    {
      useRedux: true,
      store: configureStore([thunk])({
        user: {
          ...mockUser,
          roles: { Admin: [['can_write', 'SavedQuery']] },
        },
        ...storeOverrides,
      }),
    },
  );

describe('SavedQueryList', () => {
  beforeEach(() => {
    fetchMock.resetHistory();
  });

  it('renders', async () => {
    renderList();
    expect(await screen.findByText('Saved queries')).toBeInTheDocument();
  });

  it('renders a ListView', async () => {
    renderList();
    expect(
      await screen.findByTestId('saved_query-list-view'),
    ).toBeInTheDocument();
  });

  it('renders query information', async () => {
    renderList();

    // Wait for list to load
    await screen.findByTestId('saved_query-list-view');

    // Wait for data to load
    await waitFor(() => {
      mockQueries.forEach(query => {
        expect(screen.getByText(query.label)).toBeInTheDocument();
        expect(
          screen.getByText(query.database.database_name),
        ).toBeInTheDocument();
        expect(screen.getAllByText(query.schema)[0]).toBeInTheDocument();
      });
    });
  });

  it('handles query deletion', async () => {
    renderList();

    // Wait for list to load
    await screen.findByTestId('saved_query-list-view');

    // Wait for data and find delete button
    const deleteButtons = await screen.findAllByTestId('delete-action');
    fireEvent.click(deleteButtons[0]);

    // Confirm deletion
    const deleteInput = screen.getByTestId('delete-modal-input');
    fireEvent.change(deleteInput, { target: { value: 'DELETE' } });

    const confirmButton = screen.getByRole('button', { name: /delete/i });
    fireEvent.click(confirmButton);

    // Verify API call
    await waitFor(() => {
      expect(fetchMock.calls(/saved_query\/0/, 'DELETE')).toHaveLength(1);
    });
  });

  it('handles search filtering', async () => {
    renderList();

    // Wait for list to load
    await screen.findByTestId('saved_query-list-view');

    // Find and use search input
    const searchInput = screen.getByTestId('filters-search');
    fireEvent.change(searchInput, { target: { value: 'test query' } });
    fireEvent.keyDown(searchInput, { key: 'Enter' });

    // Verify API call
    await waitFor(() => {
      const calls = fetchMock.calls(/saved_query\/\?q/);
      expect(calls.length).toBeGreaterThan(0);
      const lastCall = calls[calls.length - 1][0];
      expect(lastCall).toContain('order_column');
      expect(lastCall).toContain('page');
    });
  });

  it('fetches data', async () => {
    renderList();
    await waitFor(() => {
      const calls = fetchMock.calls(/saved_query\/\?q/);
      expect(calls).toHaveLength(1);
      expect(calls[0][0]).toContain('order_column');
      expect(calls[0][0]).toContain('page');
    });
  });

  it('handles sorting', async () => {
    renderList();

    // Wait for list to load
    await screen.findByTestId('saved_query-list-view');

    // Find and click sort header
    const sortHeaders = screen.getAllByTestId('sort-header');
    fireEvent.click(sortHeaders[0]);

    // Verify API call includes sorting
    await waitFor(() => {
      const calls = fetchMock.calls(/saved_query\/\?q/);
      const lastCall = calls[calls.length - 1][0];
      expect(lastCall).toContain('order_column:label');
    });
  });

  it('shows/hides elements based on permissions', async () => {
    // Mock info response without write permission
    fetchMock.get(
      queriesInfoEndpoint,
      { permissions: ['can_read'] },
      { overwriteRoutes: true },
    );

    // Mock list response
    fetchMock.get(
      queriesEndpoint,
      { result: mockQueries, count: mockQueries.length },
      { overwriteRoutes: true },
    );

    renderList();

    // Wait for list to load
    await screen.findByTestId('saved_query-list-view');

    // Wait for data to load
    await waitFor(() => {
      expect(screen.getByText(mockQueries[0].label)).toBeInTheDocument();
    });

    // Verify delete buttons are not shown
    expect(screen.queryByTestId('delete-action')).not.toBeInTheDocument();
  });
});
