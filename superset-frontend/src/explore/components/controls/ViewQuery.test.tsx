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
import ViewQuery, { ViewQueryProps } from './ViewQuery';

const mockHistoryPush = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useHistory: () => ({
    push: mockHistoryPush,
  }),
}));

jest.mock('src/utils/copy', () =>
  jest.fn().mockImplementation(fn => Promise.resolve(fn())),
);

function setup(props: ViewQueryProps) {
  return render(<ViewQuery {...props} />, { useRouter: true, useRedux: true });
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

it('renders the component with SQL and buttons', () => {
  const { container } = setup(mockProps);
  expect(screen.getByText('Copy')).toBeInTheDocument();
  expect(screen.getByText('Format SQL')).toBeInTheDocument();
  expect(screen.getByText('View in SQL Lab')).toBeInTheDocument();
  expect(container).toHaveTextContent(mockProps.sql);
});

// it('copies the SQL to the clipboard when Copy button is clicked', async () => {
//   setup(mockProps);
//   const copyButton = screen.getByText('Copy');
//   fireEvent.click(copyButton);
// });

it('formats the SQL when Format SQL button is clicked', async () => {
  const { container } = setup(mockProps);
  const formatButton = screen.getByText('Format SQL');

  fireEvent.click(formatButton);

  await waitFor(() =>
    expect(fetchMock.calls(formatSqlEndpoint)).toHaveLength(1),
  );
  expect(container).toHaveTextContent(formattedSQL);
});

it('toggles back to original SQL when Show Original button is clicked', async () => {
  const { container } = setup(mockProps);
  const formatButton = screen.getByText('Format SQL');

  // Click to format SQL
  fireEvent.click(formatButton);

  await waitFor(() =>
    expect(fetchMock.calls(formatSqlEndpoint)).toHaveLength(1),
  );

  // Click to show original SQL
  const showOriginalButton = screen.getByText('Show Original');
  fireEvent.click(showOriginalButton);

  await waitFor(() => expect(container).toHaveTextContent(mockProps.sql));
});

it('navigates to SQL Lab when View in SQL Lab button is clicked', () => {
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

it('opens SQL Lab in a new tab when View in SQL Lab button is clicked with meta key', () => {
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
