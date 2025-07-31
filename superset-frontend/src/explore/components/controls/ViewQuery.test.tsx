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
import copyTextToClipboard from 'src/utils/copy';
import { RootState } from 'src/dashboard/types';
import ViewQuery, { ViewQueryProps } from './ViewQuery';

const mockHistoryPush = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useHistory: () => ({
    push: mockHistoryPush,
  }),
}));

jest.mock('src/utils/copy');

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
  fetchMock.get(datasetApiEndpoint, {
    result: {
      database: {
        backend: 'sqlite',
      },
    },
  });
  fetchMock.post(formatSqlEndpoint, {
    result: formattedSQL,
  });
});

afterEach(() => {
  jest.resetAllMocks();
  fetchMock.restore();
});

const getFormatSwitch = () =>
  screen.getByRole('switch', { name: 'formatted original' });

test('renders the component with Formatted SQL and buttons', async () => {
  const { container } = setup(mockProps);
  expect(screen.getByText('Copy')).toBeInTheDocument();
  expect(getFormatSwitch()).toBeInTheDocument();
  expect(screen.getByText('View in SQL Lab')).toBeInTheDocument();

  await waitFor(() =>
    expect(fetchMock.calls(formatSqlEndpoint)).toHaveLength(1),
  );

  expect(container).toHaveTextContent(formattedSQL);
});

test('copies the SQL to the clipboard when Copy button is clicked', async () => {
  setup(mockProps);

  (copyTextToClipboard as jest.Mock).mockResolvedValue('');
  const copyButton = screen.getByText('Copy');
  expect(copyTextToClipboard as jest.Mock).not.toHaveBeenCalled();
  fireEvent.click(copyButton);
  expect(copyTextToClipboard as jest.Mock).toHaveBeenCalled();
});

test('shows the original SQL when Format switch is unchecked', async () => {
  const { container } = setup(mockProps);
  const formatButton = getFormatSwitch();

  await waitFor(() =>
    expect(fetchMock.calls(formatSqlEndpoint)).toHaveLength(1),
  );

  fireEvent.click(formatButton);

  expect(container).toHaveTextContent(mockProps.sql);
});

test('toggles back to formatted SQL when Format switch is clicked', async () => {
  const { container } = setup(mockProps);
  const formatButton = getFormatSwitch();

  await waitFor(() =>
    expect(fetchMock.calls(formatSqlEndpoint)).toHaveLength(1),
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

  expect(mockHistoryPush).toHaveBeenCalledWith('/sqllab', {
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
    `/sqllab?datasourceKey=${datasource}&sql=${sql}`,
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
