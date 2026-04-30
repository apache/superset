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
import { createMemoryHistory } from 'history';
import { MemoryRouter, Router } from 'react-router-dom';
import { QueryParamProvider } from 'use-query-params';
import { ReactRouter5Adapter } from 'use-query-params/adapters/react-router-5';
import SavedQueryList from '.';

jest.mock('src/utils/getBootstrapData', () => ({
  __esModule: true,
  default: jest.requireActual('src/utils/getBootstrapData').default,
  applicationRoot: jest.fn(() => '/superset'),
  staticAssetsPrefix: jest.requireActual('src/utils/getBootstrapData')
    .staticAssetsPrefix,
}));

// Increase default timeout
jest.setTimeout(30000);

const mockQueries = Array.from({ length: 3 }, (_, i) => ({
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

fetchMock.get(
  queriesInfoEndpoint,
  {
    permissions: ['can_write', 'can_read', 'can_export'],
  },
  { name: queriesInfoEndpoint },
);

fetchMock.get(
  queriesEndpoint,
  {
    ids: [2, 0, 1],
    result: mockQueries,
    count: mockQueries.length,
  },
  { name: queriesEndpoint },
);

fetchMock.post(permalinkEndpoint, {
  url: 'http://localhost/permalink',
});

fetchMock.delete(queryEndpoint, {}, { name: queryEndpoint });

const renderList = (props = {}, storeOverrides = {}) =>
  render(
    <MemoryRouter>
      <QueryParamProvider adapter={ReactRouter5Adapter}>
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

// Renders with a real memory history so we can spy on push/replace without
// breaking use-query-params (which needs a real location from router context).
const renderListWithHistory = (props = {}, storeOverrides = {}) => {
  const history = createMemoryHistory();
  const result = render(
    <Router history={history}>
      <QueryParamProvider adapter={ReactRouter5Adapter}>
        <SavedQueryList user={mockUser} {...props} />
      </QueryParamProvider>
    </Router>,
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
  return { ...result, history };
};

// eslint-disable-next-line no-restricted-globals -- TODO: Migrate from describe blocks
describe('SavedQueryList', () => {
  beforeEach(() => {
    fetchMock.clearHistory();
  });

  test('renders', async () => {
    renderList();
    expect(await screen.findByText('Saved queries')).toBeInTheDocument();
  });

  test('renders a ListView', async () => {
    renderList();
    expect(
      await screen.findByTestId('saved_query-list-view'),
    ).toBeInTheDocument();
  });

  test('renders query information', async () => {
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

  test('handles query deletion', async () => {
    renderList();

    // Wait for list to load
    await screen.findByTestId('saved_query-list-view');

    // Wait for data and find delete button
    const deleteButtons = await screen.findAllByTestId('delete-action');
    fireEvent.click(deleteButtons[0]);

    // Confirm deletion
    const deleteInput = screen.getByTestId('delete-modal-input');
    fireEvent.change(deleteInput, { target: { value: 'DELETE' } });

    const confirmButton = screen.getByTestId('modal-confirm-button');
    fireEvent.click(confirmButton);

    // Verify API call
    await waitFor(() => {
      expect(fetchMock.callHistory.calls(/saved_query\/0/)).toHaveLength(1);
    });
  });

  test('handles search filtering', async () => {
    renderList();

    // Wait for list to load
    await screen.findByTestId('saved_query-list-view');

    // Find and use search input
    const searchInput = screen.getByTestId('filters-search');
    fireEvent.change(searchInput, { target: { value: 'test query' } });
    fireEvent.keyDown(searchInput, { key: 'Enter' });

    // Verify API call
    await waitFor(() => {
      const lastCall = fetchMock.callHistory.lastCall(/saved_query\/\?q/);
      expect(lastCall).toBeDefined();
      expect(lastCall?.url).toContain('order_column');
      expect(lastCall?.url).toContain('page');
    });
  });

  test('fetches data', async () => {
    renderList();
    await waitFor(() => {
      const lastCall = fetchMock.callHistory.lastCall(/saved_query\/\?q/);
      expect(lastCall).toBeDefined();
      expect(lastCall?.url).toContain('order_column');
      expect(lastCall?.url).toContain('page');
    });
  });

  test('handles sorting', async () => {
    renderList();

    // Wait for list to load
    await screen.findByTestId('saved_query-list-view');

    // Find and click sort header
    const sortHeaders = screen.getAllByTestId('sort-header');
    fireEvent.click(sortHeaders[0]);

    // Verify API call includes sorting
    await waitFor(() => {
      const url = new URL(
        fetchMock.callHistory.lastCall(/saved_query\/\?q/)?.url as string,
      );
      const params = new URLSearchParams(url.search);
      const qParam = params.get('q');
      expect(qParam).toContain('order_column:label');
    });
  });

  test('window.open for "open in new tab" retains the subdirectory prefix', async () => {
    // When a query row is Cmd/Ctrl-clicked the component calls
    // window.open(makeUrl(...)) — the full application-root-prefixed URL is needed
    // because window.open operates in browser URL space, not React Router namespace.
    // This test guards against accidentally removing makeUrl from the window.open call.
    const mockWindowOpen = jest
      .spyOn(window, 'open')
      .mockImplementation(() => null);

    renderList();
    await screen.findByTestId('saved_query-list-view');
    await screen.findByText(mockQueries[0].label);

    const editButtons = await screen.findAllByTestId('edit-action');
    fireEvent.click(editButtons[0], { metaKey: true });

    expect(mockWindowOpen).toHaveBeenCalledWith(
      expect.stringContaining('/superset/sqllab'),
    );
    mockWindowOpen.mockRestore();
  });

  test('+ Query button navigates without duplicating subdirectory prefix', async () => {
    // applicationRoot is mocked to /superset. Without the fix, history.push would
    // receive /superset/sqllab?new=true, and React Router would prepend /superset
    // again, producing /superset/superset/sqllab?new=true.
    const { history } = renderListWithHistory();
    const pushSpy = jest.spyOn(history, 'push');
    await screen.findByTestId('saved_query-list-view');

    const queryButton = await screen.findByRole('button', { name: /query/i });
    fireEvent.click(queryButton);

    expect(pushSpy).toHaveBeenCalledWith('/sqllab?new=true');
    expect(pushSpy).not.toHaveBeenCalledWith(
      expect.stringContaining('/superset/sqllab'),
    );
  });

  test('query label links do not include subdirectory prefix', async () => {
    // <Link to> in React Router resolves relative to the basename, so passing
    // makeUrl('/sqllab?savedQueryId=0') would produce /superset/superset/sqllab.
    renderListWithHistory();
    await screen.findByTestId('saved_query-list-view');
    await screen.findByText(mockQueries[0].label);

    const queryLink = screen.getByRole('link', { name: mockQueries[0].label });
    expect(queryLink).toHaveAttribute('href', '/sqllab?savedQueryId=0');
    expect(queryLink).not.toHaveAttribute(
      'href',
      expect.stringContaining('/superset/sqllab'),
    );
  });

  test('shows/hides elements based on permissions', async () => {
    // Mock info response without write permission
    fetchMock.removeRoute(queriesInfoEndpoint);
    fetchMock.get(
      queriesInfoEndpoint,
      { permissions: ['can_read'] },
      { name: queriesInfoEndpoint },
    );

    // Mock list response
    fetchMock.removeRoute(queriesEndpoint);
    fetchMock.get(
      queriesEndpoint,
      { result: mockQueries, count: mockQueries.length },
      { name: queriesEndpoint },
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
