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
  screen,
  render,
  fireEvent,
  waitFor,
} from 'spec/helpers/testing-library';
import fetchMock from 'fetch-mock';
import { RootState } from 'src/dashboard/types';
import ViewQuery, { ViewQueryProps } from './ViewQuery';

const mockHistoryPush = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useHistory: () => ({
    push: mockHistoryPush,
  }),
}));

// Mock the clipboard utility
const mockCopyTextToClipboard = jest.fn<Promise<void>, [string]>(() =>
  Promise.resolve(),
);
jest.mock('src/utils/copy', () => ({
  __esModule: true,
  default: (text: string) => mockCopyTextToClipboard(text),
  copyTextToClipboard: (text: string) => mockCopyTextToClipboard(text),
}));

const mockState = (
  roles: Record<string, [string, string][]> = {
    Admin: [['menu_access', 'SQL Lab']],
  },
) =>
  ({
    user: {
      firstName: 'Test',
      isActive: true,
      isAnonymous: false,
      lastName: 'User',
      username: 'testuser',
      permissions: {} as Record<string, any>,
      roles,
    },
  }) as Partial<RootState>;

function setup(props: ViewQueryProps, state: Partial<RootState> = mockState()) {
  return render(<ViewQuery {...props} />, {
    useRouter: true,
    useRedux: true,
    initialState: state,
  });
}

const mockProps = {
  sql: 'select * from table',
  datasource: '1__table',
};

const datasetApiEndpoint = 'glob:*/api/v1/dataset/1?**';
const formatSqlEndpoint = 'glob:*/api/v1/sqllab/format_sql/';
const formattedSQL = 'SELECT * FROM table;';

beforeEach(() => {
  fetchMock.get(
    datasetApiEndpoint,
    {
      result: {
        database: {
          backend: 'sqlite',
        },
      },
    },
    { name: datasetApiEndpoint },
  );
  fetchMock.post(
    formatSqlEndpoint,
    {
      result: formattedSQL,
    },
    { name: formatSqlEndpoint },
  );
});

afterEach(() => {
  jest.resetAllMocks();
  fetchMock.clearHistory().removeRoutes();
});

const getFormatSwitch = () =>
  screen.getByRole('switch', { name: 'formatted original' });

test('renders the component with Formatted SQL and buttons', async () => {
  const { container } = setup(mockProps);
  expect(screen.getByText('Copy')).toBeInTheDocument();
  expect(getFormatSwitch()).toBeInTheDocument();
  expect(screen.getByText('View in SQL Lab')).toBeInTheDocument();

  await waitFor(() =>
    expect(fetchMock.callHistory.calls(formatSqlEndpoint)).toHaveLength(1),
  );

  expect(container).toHaveTextContent(formattedSQL);
});

test('copies the SQL to the clipboard when Copy button is clicked', async () => {
  mockCopyTextToClipboard.mockClear();
  mockCopyTextToClipboard.mockResolvedValue(undefined);
  setup(mockProps);

  const copyButton = screen.getByText('Copy');
  expect(mockCopyTextToClipboard).not.toHaveBeenCalled();
  fireEvent.click(copyButton);
  expect(mockCopyTextToClipboard).toHaveBeenCalled();
});

test('shows the original SQL when Format switch is unchecked', async () => {
  const { container } = setup(mockProps);
  const formatButton = getFormatSwitch();

  await waitFor(() =>
    expect(fetchMock.callHistory.calls(formatSqlEndpoint)).toHaveLength(1),
  );

  fireEvent.click(formatButton);

  expect(container).toHaveTextContent(mockProps.sql);
});

test('toggles back to formatted SQL when Format switch is clicked', async () => {
  const { container } = setup(mockProps);
  const formatButton = getFormatSwitch();

  await waitFor(() =>
    expect(fetchMock.callHistory.calls(formatSqlEndpoint)).toHaveLength(1),
  );

  // Click to format SQL
  fireEvent.click(formatButton);

  await waitFor(() => expect(container).toHaveTextContent(mockProps.sql));

  // Toggle format switch
  fireEvent.click(formatButton);

  await waitFor(() => expect(container).toHaveTextContent(formattedSQL));
});

test('navigates to SQL Lab when View in SQL Lab button is clicked', () => {
  setup(mockProps);

  const viewInSQLLabButton = screen.getByText('View in SQL Lab');
  fireEvent.click(viewInSQLLabButton);

  expect(mockHistoryPush).toHaveBeenCalledWith({
    pathname: '/sqllab',
    state: {
      requestedQuery: {
        datasourceKey: mockProps.datasource,
        sql: mockProps.sql,
      },
    },
  });
});

test('opens SQL Lab in a new tab when View in SQL Lab button is clicked with meta key', () => {
  window.open = jest.fn();

  setup(mockProps);
  const viewInSQLLabButton = screen.getByText('View in SQL Lab');

  fireEvent.click(viewInSQLLabButton, { metaKey: true });

  const { datasource, sql } = mockProps;
  expect(window.open).toHaveBeenCalledWith(
    `/sqllab?datasourceKey=${datasource}&sql=${encodeURIComponent(sql)}`,
    '_blank',
  );
});

test('hides View in SQL Lab button when user does not have SQL Lab access', () => {
  setup(
    mockProps,
    mockState({
      Basic: [['menu_access', 'Dashboard']],
    }),
  );

  expect(screen.queryByText('View in SQL Lab')).not.toBeInTheDocument();
  expect(screen.getByText('Copy')).toBeInTheDocument(); // Copy button should still be visible
});

test('handles undefined datasource without crashing', () => {
  const propsWithUndefinedDatasource = {
    ...mockProps,
    datasource: undefined as any,
  };

  expect(() => setup(propsWithUndefinedDatasource)).not.toThrow();
});

test('handles dataset API error gracefully when no exploreBackend', async () => {
  const stateWithoutBackend = {
    ...mockState(),
    explore: undefined,
  };

  fetchMock.removeRoute(datasetApiEndpoint);
  fetchMock.get(datasetApiEndpoint, { throws: new Error('API Error') });

  setup(mockProps, stateWithoutBackend);

  await waitFor(() => {
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });

  expect(fetchMock.callHistory.calls(formatSqlEndpoint)).toHaveLength(0);
});

test('handles SQL formatting API error gracefully', async () => {
  const stateWithoutBackend = {
    ...mockState(),
    explore: undefined,
  };

  fetchMock.removeRoute(formatSqlEndpoint);
  fetchMock.post(formatSqlEndpoint, { throws: new Error('Format Error') });

  setup(mockProps, stateWithoutBackend);

  await waitFor(() => {
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });
});

test('uses exploreBackend from Redux state when available', async () => {
  const stateWithBackend = {
    ...mockState(),
    explore: {
      datasource: {
        database: {
          backend: 'postgresql',
        },
      },
    },
  };

  setup(mockProps, stateWithBackend);

  await waitFor(() => {
    expect(fetchMock.callHistory.calls(formatSqlEndpoint)).toHaveLength(1);
  });

  const formatCallBody = JSON.parse(
    fetchMock.callHistory.lastCall(formatSqlEndpoint)?.options.body as string,
  );
  expect(formatCallBody.engine).toBe('postgresql');
  expect(fetchMock.callHistory.calls(datasetApiEndpoint)).toHaveLength(0);
});

test('sends engine as string (not object) when fetched from dataset API', async () => {
  const stateWithoutBackend = {
    ...mockState(),
    explore: undefined,
  };

  setup(mockProps, stateWithoutBackend);

  await waitFor(() => {
    expect(fetchMock.callHistory.calls(datasetApiEndpoint)).toHaveLength(1);
  });

  await waitFor(() => {
    expect(fetchMock.callHistory.calls(formatSqlEndpoint)).toHaveLength(1);
  });

  const formatCallBody = JSON.parse(
    fetchMock.callHistory.lastCall(formatSqlEndpoint)?.options.body as string,
  );

  expect(formatCallBody).toEqual({
    sql: mockProps.sql,
    engine: 'sqlite',
  });
});
