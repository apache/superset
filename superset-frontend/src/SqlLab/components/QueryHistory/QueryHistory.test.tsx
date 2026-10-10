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
import { render, screen, waitFor, within } from 'spec/helpers/testing-library';
import QueryHistory from 'src/SqlLab/components/QueryHistory';
import {
  initialState,
  defaultQueryEditor,
  extraQueryEditor3,
} from 'src/SqlLab/fixtures';
import { ViewLocations } from 'src/SqlLab/contributions';
import {
  registerToolbarAction,
  cleanupExtensions,
} from 'spec/helpers/extensionTestHelpers';

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

afterEach(() => {
  fetchMock.clearHistory().removeRoutes();
  cleanupExtensions();
  mockedIsFeatureEnabled.mockReset();
});

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
    expect(fetchMock.callHistory.calls(editorQueryApiRoute).length).toBe(1),
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
    expect(fetchMock.callHistory.calls(editorQueryApiRoute).length).toBe(1),
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
    expect(fetchMock.callHistory.calls(editorQueryApiRoute).length).toBe(1),
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

// `sql` is never part of the merge's overlay bundle, so a merged row's `sql`
// always comes from the `{...remoteQuery}` base, whether or not an override
// happened. Every live-only Redux fixture below uses `sql: 'SELECT 1'`,
// while the backend snapshot uses this distinctive query text - so this can
// only resolve once the backend response has actually loaded *and* been
// folded into the rendered row, unlike `waitFor(() => calls.length === 1)`,
// which resolves as soon as the request is issued, while `data` is still
// `undefined` and the component is still rendering the pre-merge,
// Redux-only fallback. Deliberately not a Duration-cell/`endDttm` barrier:
// a real Redux row that has concluded always has an `endDttm` (see
// `QUERY_SUCCESS` in `reducers/sqlLab.ts`), so that barrier would silently
// go vacuous the moment a fixture became realistic about timestamps.
const findRemoteSqlCell = () => screen.findByText(/FCC 2018 Survey/);

// The barrier above holds only while the live fixture's sql differs from the
// snapshot's. If they ever match, findRemoteSqlCell() resolves pre-merge and
// every assertion after it goes vacuous. Fail loudly rather than silently.
const assertLiveSqlDiffersFromSnapshot = (q: { sql: string }) =>
  expect(q.sql).not.toMatch(/FCC 2018 Survey/);

test('overrides a stale non-concluded backend snapshot with a concluded live Redux state', async () => {
  const isFeatureEnabledMock = mockedIsFeatureEnabled.mockImplementation(
    featureFlag => featureFlag === FeatureFlag.SqllabBackendPersistence,
  );

  // A non-concluded row's `end_time` is never set by the backend (every
  // write of `end_time` is paired with a concluded status - see
  // `superset/sql_lab.py` and `superset/daos/query.py`). Note this maps to
  // `endDttm: 0`, not `undefined` - `mapQueryResponse` does
  // `Number(query.end_time)` and `Number(null) === 0`.
  const staleApiResult = {
    count: 1,
    ids: [692],
    result: [
      {
        ...fakeApiResult.result[0],
        client_id: 'stuckClientId',
        status: QueryState.Running,
        progress: 0,
        rows: 0,
        end_time: null,
        sql_editor_id: defaultQueryEditor.id,
      },
    ],
  };

  const editorQueryApiRoute = `glob:*/api/v1/query/?q=*`;
  fetchMock.get(editorQueryApiRoute, staleApiResult);

  const stateWithLiveQuery = {
    ...initialState,
    sqlLab: {
      ...initialState.sqlLab,
      queries: {
        stuckClientId: {
          id: 'stuckClientId',
          sqlEditorId: defaultQueryEditor.id,
          sql: 'SELECT 1',
          state: QueryState.Success,
          startDttm: 1710273662445,
          // A real Redux row at Success always has an endDttm too -
          // QUERY_SUCCESS sets both together.
          endDttm: 1710273662500,
          progress: 100,
          rows: 443,
        },
      },
    },
  };

  assertLiveSqlDiffersFromSnapshot(
    stateWithLiveQuery.sqlLab.queries.stuckClientId,
  );
  render(setup(), { useRedux: true, initialState: stateWithLiveQuery });

  await waitFor(() =>
    expect(fetchMock.callHistory.calls(editorQueryApiRoute).length).toBe(1),
  );
  await findRemoteSqlCell();

  const row = screen.getByText('443').closest('tr') as HTMLElement;
  expect(within(row).getByLabelText('check')).toBeInTheDocument();
  expect(within(row).queryByLabelText('loading')).not.toBeInTheDocument();

  isFeatureEnabledMock.mockClear();
});

test('does not override an already-concluded backend snapshot with a non-concluded Redux state', async () => {
  const isFeatureEnabledMock = mockedIsFeatureEnabled.mockImplementation(
    featureFlag => featureFlag === FeatureFlag.SqllabBackendPersistence,
  );

  const concludedApiResult = {
    count: 1,
    ids: [692],
    result: [
      {
        ...fakeApiResult.result[0],
        client_id: 'scheduledClientId',
        status: QueryState.Success,
        progress: 100,
        rows: 443,
        sql_editor_id: defaultQueryEditor.id,
      },
    ],
  };

  const editorQueryApiRoute = `glob:*/api/v1/query/?q=*`;
  fetchMock.get(editorQueryApiRoute, concludedApiResult);

  // Redux hasn't observed this query conclude yet: it's still Scheduled.
  // Deliberately not Running/Pending with progress 0, which is the tuple
  // CLEAR_INACTIVE_QUERIES evicts once stale - that combination can't
  // actually reach this merge in production.
  const stateWithScheduledQuery = {
    ...initialState,
    sqlLab: {
      ...initialState.sqlLab,
      queries: {
        scheduledClientId: {
          id: 'scheduledClientId',
          sqlEditorId: defaultQueryEditor.id,
          sql: 'SELECT 1',
          state: QueryState.Scheduled,
          startDttm: 1710273662445,
          progress: 0,
          rows: 0,
        },
      },
    },
  };

  assertLiveSqlDiffersFromSnapshot(
    stateWithScheduledQuery.sqlLab.queries.scheduledClientId,
  );
  render(setup(), { useRedux: true, initialState: stateWithScheduledQuery });

  await waitFor(() =>
    expect(fetchMock.callHistory.calls(editorQueryApiRoute).length).toBe(1),
  );
  await findRemoteSqlCell();

  const row = screen.getByText('443').closest('tr') as HTMLElement;
  expect(within(row).getByLabelText('check')).toBeInTheDocument();
  expect(within(row).queryByLabelText('loading')).not.toBeInTheDocument();

  isFeatureEnabledMock.mockClear();
});

test('renders a backend-only historical query the client never ran, alongside a live one', async () => {
  const isFeatureEnabledMock = mockedIsFeatureEnabled.mockImplementation(
    featureFlag => featureFlag === FeatureFlag.SqllabBackendPersistence,
  );

  const twoRowApiResult = {
    count: 2,
    ids: [692, 700],
    result: [
      {
        ...fakeApiResult.result[0],
        client_id: 'liveClientId',
        status: QueryState.Running,
        progress: 0,
        rows: 0,
        // Non-concluded: the backend never sets end_time for this status
        // (maps to endDttm: 0, not undefined - see the comment above).
        end_time: null,
        sql_editor_id: defaultQueryEditor.id,
      },
      {
        ...fakeApiResult.result[0],
        id: 700,
        client_id: 'historicalOnlyClientId',
        status: QueryState.Success,
        progress: 100,
        rows: 12,
        sql_editor_id: defaultQueryEditor.id,
        start_time: '1710273660000.000000',
        // A different table than the live row's, so findRemoteSqlCell's
        // target text is unique to that row, not duplicated on this one.
        sql: 'SELECT * from "Population"',
        executed_sql: 'SELECT * from "Population"\nLIMIT 1001',
      },
    ],
  };

  const editorQueryApiRoute = `glob:*/api/v1/query/?q=*`;
  fetchMock.get(editorQueryApiRoute, twoRowApiResult);

  const stateWithOnlyOneLiveQuery = {
    ...initialState,
    sqlLab: {
      ...initialState.sqlLab,
      queries: {
        liveClientId: {
          id: 'liveClientId',
          sqlEditorId: defaultQueryEditor.id,
          sql: 'SELECT 1',
          state: QueryState.Success,
          startDttm: 1710273662445,
          // A real Redux row at Success always has an endDttm too -
          // QUERY_SUCCESS sets both together.
          endDttm: 1710273662500,
          progress: 100,
          rows: 443,
        },
      },
    },
  };

  assertLiveSqlDiffersFromSnapshot(
    stateWithOnlyOneLiveQuery.sqlLab.queries.liveClientId,
  );
  const { container } = render(setup(), {
    useRedux: true,
    initialState: stateWithOnlyOneLiveQuery,
  });

  await waitFor(() =>
    expect(fetchMock.callHistory.calls(editorQueryApiRoute).length).toBe(1),
  );
  await findRemoteSqlCell();

  const tableRows = container.querySelectorAll(
    'table > tbody > tr:not(.ant-table-measure-row)',
  );
  expect(tableRows).toHaveLength(2);

  const liveRow = screen.getByText('443').closest('tr') as HTMLElement;
  expect(within(liveRow).getByLabelText('check')).toBeInTheDocument();
  expect(within(liveRow).queryByLabelText('loading')).not.toBeInTheDocument();

  const historicalRow = screen.getByText('12').closest('tr') as HTMLElement;
  expect(within(historicalRow).getByLabelText('check')).toBeInTheDocument();
  expect(
    within(historicalRow).queryByLabelText('loading'),
  ).not.toBeInTheDocument();

  isFeatureEnabledMock.mockClear();
});

test('renders contributed toolbar action in queryHistory slot', () => {
  registerToolbarAction(
    ViewLocations.sqllab.queryHistory,
    'test-history-action',
    'History Action',
    jest.fn(),
  );

  const stateWithQueries = {
    ...initialState,
    sqlLab: {
      ...initialState.sqlLab,
      queries: {
        testQuery: {
          id: 'testQuery',
          sqlEditorId: defaultQueryEditor.id,
          sql: 'SELECT 1',
          state: QueryState.Success,
          startDttm: Date.now(),
          endDttm: Date.now() + 100,
          progress: 100,
          rows: 1,
          cached: false,
          changed_on: new Date().toISOString(),
          db: 'main',
          dbId: 1,
        },
      },
    },
  };

  render(setup(), {
    useRedux: true,
    initialState: stateWithQueries,
  });

  expect(
    screen.getByRole('button', { name: 'History Action' }),
  ).toBeInTheDocument();
});
