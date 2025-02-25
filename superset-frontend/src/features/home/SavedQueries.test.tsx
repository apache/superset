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
import fetchMock from 'fetch-mock';
import { render, screen, waitFor, within } from 'spec/helpers/testing-library';
import userEvent from '@testing-library/user-event';
import SavedQueries from './SavedQueries';

// Mock createErrorHandler to directly call the error message function
jest.mock('src/views/CRUD/utils', () => ({
  ...jest.requireActual('src/views/CRUD/utils'),
  createErrorHandler: (errMsg: (message: string) => void) => (error: any) => {
    errMsg(error.message || error.error || error);
    return error;
  },
  getFilterValues: () => ({}),
  PAGE_SIZE: 25,
  shortenSQL: (sql: string) => sql,
}));

// Mock SupersetClient separately to avoid jest.mock() reference error
const mockSupersetDelete = jest.fn();
jest.mock('@superset-ui/core', () => ({
  ...jest.requireActual('@superset-ui/core'),
  t: (str: string, ...args: any[]) => {
    if (str === 'Modified %s') {
      const [time] = args;
      return `Modified ${time}`;
    }
    if (str === 'There was an issue deleting %s: %s') {
      const [label, error] = args;
      return `There was an issue deleting ${label}: ${error}`;
    }
    return str;
  },
  SupersetClient: {
    delete: (...args: any[]) => mockSupersetDelete(...args),
  },
  styled: jest.requireActual('@superset-ui/core').styled,
  useTheme: jest.requireActual('@superset-ui/core').useTheme,
}));

jest.mock('src/components/ListViewCard', () => {
  const ListViewCard = ({ title, description, actions }: any) => (
    <div data-test="list-view-card">
      <div data-test="title">{title}</div>
      <div data-test="description">{description}</div>
      <div data-test="actions">{actions}</div>
    </div>
  );
  ListViewCard.Actions = ({ children }: any) => (
    <div data-test="list-view-card-actions">{children}</div>
  );
  return ListViewCard;
});

jest.mock('./SubMenu', () => ({
  __esModule: true,
  default: ({ tabs, buttons }: any) => (
    <div data-test="submenu">
      {tabs?.map((tab: any) => (
        <div key={tab.name} role="tab" tabIndex={0} onClick={tab.onClick}>
          {tab.label}
        </div>
      ))}
      {buttons?.map((button: any) => (
        <div key={typeof button.name === 'string' ? button.name : 'button'}>
          {button.name}
        </div>
      ))}
    </div>
  ),
}));

jest.mock('src/pages/Home', () => ({
  LoadingCards: () => <div data-testid="loading-cards">Loading...</div>,
}));

const mockQueries = [...new Array(3)].map((_, i) => ({
  created_by: {
    id: i,
    first_name: `user`,
    last_name: `${i}`,
  },
  created_on: `${i}-2020`,
  database: {
    database_name: `db ${i}`,
    id: i,
  },
  changed_on_delta_humanized: '1 day ago',
  db_id: i,
  description: `SQL for ${i}`,
  id: i,
  label: `query ${i}`,
  schema: 'public',
  sql: `SELECT ${i} FROM table`,
  sql_tables: [
    {
      catalog: null,
      schema: null,
      table: `${i}`,
    },
  ],
}));

const mockUser = {
  userId: '1',
  firstName: 'Test',
  lastName: 'User',
};

const savedQueriesInfo = 'glob:*/api/v1/saved_query/_info*';
const queriesEndpoint = 'glob:*/api/v1/saved_query/?*';

const mockState = {
  user: {
    userId: '1',
  },
};

const setup = (props = {}) => {
  const baseProps = {
    user: mockUser,
    addDangerToast: jest.fn(),
    addSuccessToast: jest.fn(),
    mine: mockQueries,
    showThumbnails: true,
    featureFlag: true,
    ...props,
  };

  return render(<SavedQueries {...baseProps} />, {
    useRedux: true,
    initialState: mockState,
    useRouter: true,
  });
};

describe('SavedQueries', () => {
  beforeEach(() => {
    fetchMock.get(savedQueriesInfo, {
      permissions: ['can_read', 'can_write', 'can_edit', 'can_delete'],
    });
    fetchMock.get(queriesEndpoint, {
      result: mockQueries,
      count: mockQueries.length,
    });
    mockSupersetDelete.mockImplementation(() =>
      Promise.resolve({
        json: { message: 'ok' },
        response: new Response(),
      }),
    );
  });

  afterEach(() => {
    fetchMock.restore();
    jest.clearAllMocks();
  });

  it('renders the saved queries list view', async () => {
    setup();

    // Verify navigation elements
    expect(
      await screen.findByRole('tab', { name: 'Mine' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/SQL Query/)).toBeInTheDocument();
    expect(screen.getByText(/View All/)).toBeInTheDocument();

    // Verify queries are displayed
    // Verify queries are displayed
    const queryPromises = mockQueries.map(async (_, i) => {
      const queryText = await screen.findByText(`query ${i}`);
      expect(queryText).toBeInTheDocument();
      expect(screen.getAllByText('Modified 1 day ago')[i]).toBeInTheDocument();
    });
    await Promise.all(queryPromises);
  });

  it('shows empty state when no queries exist', async () => {
    fetchMock.get(
      queriesEndpoint,
      {
        result: [],
        count: 0,
      },
      { overwriteRoutes: true },
    );

    setup({ mine: [] });

    expect(await screen.findByText('Nothing here yet')).toBeInTheDocument();
  });

  it('shows loading state while fetching queries', async () => {
    setup();

    // Wait for loading state to disappear
    await waitFor(() => {
      expect(screen.queryByTestId('loading-cards')).not.toBeInTheDocument();
    });
  });

  it('allows deleting a query with confirmation', async () => {
    setup();

    // Wait for queries to load
    const firstQuery = await screen.findByText('query 0');
    const queryCard = firstQuery.closest(
      '[data-test="list-view-card"]',
    ) as HTMLElement;
    expect(queryCard).toBeInTheDocument();

    // Open actions menu for first query
    const moreButton = within(queryCard).getByRole('img', {
      name: 'more-vert',
    });
    await userEvent.click(moreButton);

    // Click delete option
    const deleteButton = within(queryCard).getByText('Delete');
    await userEvent.click(deleteButton);

    // Verify delete modal
    const modal = await screen.findByRole('dialog');
    expect(modal).toHaveTextContent('Delete Query?');
    expect(modal).toHaveTextContent(
      'This action will permanently delete the saved query.',
    );

    // Confirm deletion
    const confirmButton = screen.getByRole('button', { name: /confirm/i });
    await userEvent.click(confirmButton);

    // Verify API call
    expect(mockSupersetDelete).toHaveBeenCalledWith({
      endpoint: '/api/v1/saved_query/0',
    });
  });

  it('shows edit and share options for queries', async () => {
    setup();

    // Wait for queries to load
    const firstQuery = await screen.findByText('query 0');
    const queryCard = firstQuery.closest(
      '[data-test="list-view-card"]',
    ) as HTMLElement;
    expect(queryCard).toBeInTheDocument();

    // Open actions menu
    const moreButton = within(queryCard).getByRole('img', {
      name: 'more-vert',
    });
    await userEvent.click(moreButton);

    // Verify menu options
    const editButton = within(queryCard).getByText('Edit');
    const shareButton = within(queryCard).getByText('Share');
    expect(editButton).toBeInTheDocument();
    expect(shareButton).toBeInTheDocument();

    // Verify edit link
    expect(editButton.closest('a')).toHaveAttribute(
      'href',
      '/sqllab?savedQueryId=0',
    );
  });

  it('handles errors when deleting queries', async () => {
    const addDangerToast = jest.fn();
    mockSupersetDelete.mockRejectedValue(new Error('Error'));

    setup({ addDangerToast });

    // Wait for queries to load
    const firstQuery = await screen.findByText('query 0');
    const queryCard = firstQuery.closest(
      '[data-test="list-view-card"]',
    ) as HTMLElement;
    expect(queryCard).toBeInTheDocument();

    // Open actions menu
    const moreButton = within(queryCard).getByRole('img', {
      name: 'more-vert',
    });
    await userEvent.click(moreButton);

    // Click delete option
    const deleteButton = within(queryCard).getByText('Delete');
    await userEvent.click(deleteButton);

    // Confirm deletion
    const confirmButton = screen.getByRole('button', { name: /confirm/i });
    await userEvent.click(confirmButton);

    // Wait for error handler to be called
    await waitFor(
      () => {
        expect(addDangerToast).toHaveBeenCalledWith(
          'There was an issue deleting query 0: Error',
        );
      },
      { interval: 100, timeout: 2000 },
    );
  });
});
