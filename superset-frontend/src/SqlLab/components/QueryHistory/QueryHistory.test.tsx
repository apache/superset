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
import { FeatureFlag, isFeatureEnabled, QueryState } from '@superset-ui/core';
import { render, screen, waitFor } from 'spec/helpers/testing-library';
import QueryHistory from 'src/SqlLab/components/QueryHistory';
import {
  initialState,
  defaultQueryEditor,
  extraQueryEditor3,
} from 'src/SqlLab/fixtures';

const mockedProps = {
  queryEditorId: defaultQueryEditor.id,
  displayLimit: 1000,
  latestQueryId: 'yhMUZCGb',
};

const fakeApiResult = {
  count: 4,
  ids: [692],
  result: [
    {
      changed_on: '2024-03-12T20:01:02.497775',
      client_id: 'b0ZDzRYzn',
      database: {
        database_name: 'examples',
        id: 1,
      },
      end_time: '1710273662496.047852',
      error_message: null,
      executed_sql: 'SELECT * from "FCC 2018 Survey"\nLIMIT 1001',
      id: 692,
      limit: 1000,
      limiting_factor: 'DROPDOWN',
      progress: 100,
      results_key: null,
      rows: 443,
      schema: 'main',
      select_as_cta: false,
      sql: 'SELECT * from "FCC 2018 Survey" ',
      sql_editor_id: '22',
      start_time: '1710273662445.992920',
      status: QueryState.Success,
      tab_name: 'Untitled Query 16',
      tmp_table_name: null,
      tracking_url: null,
      user: {
        first_name: 'admin',
        id: 1,
        last_name: 'user',
      },
    },
  ],
};

jest.mock('@superset-ui/core', () => ({
  ...jest.requireActual('@superset-ui/core'),
  isFeatureEnabled: jest.fn(),
}));

const mockedIsFeatureEnabled = isFeatureEnabled as jest.Mock;

const setup = (overrides = {}) => (
  <QueryHistory {...mockedProps} {...overrides} />
);

afterEach(() => fetchMock.reset());

test('Renders an empty state for query history', () => {
  render(setup(), { useRedux: true, initialState });

  const emptyStateText = screen.getByText(
    /run a query to display query history/i,
  );

  expect(emptyStateText).toBeVisible();
});

test('fetches the query history when the persistence mode is enabled', async () => {
  const isFeatureEnabledMock = mockedIsFeatureEnabled.mockImplementation(
    featureFlag => featureFlag === FeatureFlag.SqllabBackendPersistence,
  );

  const editorQueryApiRoute = `glob:*/api/v1/query/?q=*`;
  fetchMock.get(editorQueryApiRoute, fakeApiResult);
  render(setup(), { useRedux: true, initialState });
  await waitFor(() =>
    expect(fetchMock.calls(editorQueryApiRoute).length).toBe(1),
  );
  const queryResultText = screen.getByText(fakeApiResult.result[0].rows);
  expect(queryResultText).toBeInTheDocument();
  isFeatureEnabledMock.mockClear();
});

test('fetches the query history by the tabViewId', async () => {
  const isFeatureEnabledMock = mockedIsFeatureEnabled.mockImplementation(
    featureFlag => featureFlag === FeatureFlag.SqllabBackendPersistence,
  );

  const editorQueryApiRoute = `glob:*/api/v1/query/?q=*sql_editor_id*${extraQueryEditor3.tabViewId}*`;
  fetchMock.get(editorQueryApiRoute, fakeApiResult);
  render(setup({ queryEditorId: extraQueryEditor3.id }), {
    useRedux: true,
    initialState: {
      ...initialState,
      sqlLab: {
        ...initialState.sqlLab,
        queryEditors: [...initialState.sqlLab.queryEditors, extraQueryEditor3],
      },
    },
  });
  await waitFor(() =>
    expect(fetchMock.calls(editorQueryApiRoute).length).toBe(1),
  );
  const queryResultText = screen.getByText(fakeApiResult.result[0].rows);
  expect(queryResultText).toBeInTheDocument();
  isFeatureEnabledMock.mockClear();
});

test('displays multiple queries with newest query first', async () => {
  const isFeatureEnabledMock = mockedIsFeatureEnabled.mockImplementation(
    featureFlag => featureFlag === FeatureFlag.SqllabBackendPersistence,
  );

  const multipleQueriesApiResult = {
    count: 2,
    ids: [694, 693],
    result: [
      {
        changed_on: '2024-03-12T20:10:02.497775',
        client_id: 'd2ZDzRYzn',
        database: {
          database_name: 'examples',
          id: 1,
        },
        end_time: '1710274202496.047852',
        error_message: null,
        executed_sql: 'SELECT COUNT(*) from "FCC 2018 Survey"\nLIMIT 1001',
        id: 694,
        limit: 1000,
        limiting_factor: 'DROPDOWN',
        progress: 100,
        results_key: null,
        rows: 1,
        schema: 'main',
        select_as_cta: false,
        sql: 'SELECT COUNT(*) from "FCC 2018 Survey"',
        sql_editor_id: '22',
        start_time: '1710274202445.992920',
        status: QueryState.Success,
        tab_name: 'Untitled Query 2',
        tmp_table_name: null,
        tracking_url: null,
        user: {
          first_name: 'admin',
          id: 1,
          last_name: 'user',
        },
      },
      {
        changed_on: '2024-03-12T20:01:02.497775',
        client_id: 'b0ZDzRYzn',
        database: {
          database_name: 'examples',
          id: 1,
        },
        end_time: '1710273662496.047852',
        error_message: null,
        executed_sql: 'SELECT * from "FCC 2018 Survey"\nLIMIT 1001',
        id: 693,
        limit: 1000,
        limiting_factor: 'DROPDOWN',
        progress: 100,
        results_key: null,
        rows: 443,
        schema: 'main',
        select_as_cta: false,
        sql: 'SELECT * from "FCC 2018 Survey"',
        sql_editor_id: '22',
        start_time: '1710273662445.992920',
        status: QueryState.Success,
        tab_name: 'Untitled Query 1',
        tmp_table_name: null,
        tracking_url: null,
        user: {
          first_name: 'admin',
          id: 1,
          last_name: 'user',
        },
      },
    ],
  };

  const editorQueryApiRoute = `glob:*/api/v1/query/?q=*`;
  fetchMock.get(editorQueryApiRoute, multipleQueriesApiResult);
  const { container } = render(setup(), { useRedux: true, initialState });

  await waitFor(() =>
    expect(fetchMock.calls(editorQueryApiRoute).length).toBe(1),
  );

  expect(screen.getByTestId('listview-table')).toBeVisible();
  expect(screen.getByRole('table')).toBeVisible();

  const tableRows = container.querySelectorAll(
    'table > tbody > tr:not(.ant-table-measure-row)',
  );
  expect(tableRows).toHaveLength(2);

  // Check that both queries are present
  const olderQueryRow = screen.getByText('443');
  const newerQueryElements = screen.getAllByText('1');
  expect(olderQueryRow).toBeInTheDocument();
  expect(newerQueryElements.length).toBeGreaterThan(0);

  // Verify ordering: newer query (1 row) should appear before older query (443 rows)
  // Find the actual row elements to check their order
  const firstDataRow = tableRows[0];
  const secondDataRow = tableRows[1];

  // The newer query should be in the first row (has 1 result row)
  expect(firstDataRow).toHaveTextContent('1');
  // The older query should be in the second row (has 443 result rows)
  expect(secondDataRow).toHaveTextContent('443');

  isFeatureEnabledMock.mockClear();
});
