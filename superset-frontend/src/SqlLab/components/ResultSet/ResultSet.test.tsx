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
import { render, screen, waitFor } from 'spec/helpers/testing-library';
import configureStore from 'redux-mock-store';
import { Store } from 'redux';
import thunk from 'redux-thunk';
import fetchMock from 'fetch-mock';
import ResultSet from 'src/SqlLab/components/ResultSet';
import {
  cachedQuery,
  failedQueryWithErrorMessage,
  failedQueryWithErrors,
  queries,
  runningQuery,
  stoppedQuery,
  initialState,
  user,
  queryWithNoQueryLimit,
  failedQueryWithFrontendTimeoutErrors,
} from 'src/SqlLab/fixtures';

const mockedProps = {
  cache: true,
  queryId: queries[0].id,
  height: 140,
  database: { allows_virtual_table_explore: true },
  displayLimit: 1000,
  defaultQueryLimit: 1000,
};
const stoppedQueryState = {
  ...initialState,
  sqlLab: {
    ...initialState.sqlLab,
    queries: {
      [stoppedQuery.id]: stoppedQuery,
    },
  },
};
const runningQueryState = {
  ...initialState,
  sqlLab: {
    ...initialState.sqlLab,
    queries: {
      [runningQuery.id]: runningQuery,
    },
  },
};
const fetchingQueryState = {
  ...initialState,
  sqlLab: {
    ...initialState.sqlLab,
    queries: {
      [mockedProps.queryId]: {
        dbId: 1,
        cached: false,
        ctas: false,
        id: 'ryhHUZCGb',
        progress: 100,
        state: 'fetching',
        startDttm: Date.now() - 500,
      },
    },
  },
};
const cachedQueryState = {
  ...initialState,
  sqlLab: {
    ...initialState.sqlLab,
    queries: {
      [cachedQuery.id]: cachedQuery,
    },
  },
};
const failedQueryWithErrorMessageState = {
  ...initialState,
  sqlLab: {
    ...initialState.sqlLab,
    queries: {
      [failedQueryWithErrorMessage.id]: failedQueryWithErrorMessage,
    },
  },
};
const failedQueryWithErrorsState = {
  ...initialState,
  sqlLab: {
    ...initialState.sqlLab,
    queries: {
      [failedQueryWithErrors.id]: failedQueryWithErrors,
    },
  },
};
const failedQueryWithTimeoutState = {
  ...initialState,
  sqlLab: {
    ...initialState.sqlLab,
    queries: {
      [failedQueryWithFrontendTimeoutErrors.id]:
        failedQueryWithFrontendTimeoutErrors,
    },
  },
};

const newProps = {
  displayLimit: 1001,
};
const asyncQueryProps = {
  ...mockedProps,
  database: { allow_run_async: true },
};

const reRunQueryEndpoint = 'glob:*/api/v1/sqllab/execute/';
fetchMock.get('glob:*/api/v1/dataset/?*', { result: [] });
fetchMock.post(reRunQueryEndpoint, { result: [] });
fetchMock.get('glob:*/api/v1/sqllab/results/*', { result: [] });

beforeEach(() => {
  fetchMock.resetHistory();
});

const middlewares = [thunk];
const mockStore = configureStore(middlewares);
const setup = (props?: any, store?: Store) =>
  render(<ResultSet {...props} />, {
    useRedux: true,
    ...(store && { store }),
  });

describe('ResultSet', () => {
  test('renders a Table', async () => {
    const { getByTestId } = setup(
      mockedProps,
      mockStore({
        ...initialState,
        user,
        sqlLab: {
          ...initialState.sqlLab,
          queries: {
            [queries[0].id]: queries[0],
          },
        },
      }),
    );
    const table = getByTestId('table-container');
    expect(table).toBeInTheDocument();
  });

  test('should render success query', async () => {
    const query = queries[0];
    const { queryAllByText, getByTestId } = setup(
      mockedProps,
      mockStore({
        ...initialState,
        user,
        sqlLab: {
          ...initialState.sqlLab,
          queries: {
            [query.id]: query,
          },
        },
      }),
    );

    const table = getByTestId('table-container');
    expect(table).toBeInTheDocument();

    const firstColumn = queryAllByText(
      query.results?.columns[0].column_name ?? '',
    )[0];
    const secondColumn = queryAllByText(
      query.results?.columns[1].column_name ?? '',
    )[0];
    expect(firstColumn).toBeInTheDocument();
    expect(secondColumn).toBeInTheDocument();

    const exploreButton = getByTestId('explore-results-button');
    expect(exploreButton).toBeInTheDocument();
  });

  test('should render empty results', async () => {
    const query = {
      ...queries[0],
      results: { data: [] },
    };
    await waitFor(() => {
      setup(
        mockedProps,
        mockStore({
          ...initialState,
          user,
          sqlLab: {
            ...initialState.sqlLab,
            queries: {
              [query.id]: query,
            },
          },
        }),
      );
    });

    const alert = screen.getByRole('alert');
    expect(alert).toBeInTheDocument();
    expect(alert).toHaveTextContent('The query returned no data');
  });

  test('should call reRunQuery if timed out', async () => {
    const query = {
      ...queries[0],
      errorMessage: 'Your session timed out',
    };
    const store = mockStore({
      ...initialState,
      user,
      sqlLab: {
        ...initialState.sqlLab,
        queries: {
          [query.id]: query,
        },
      },
    });

    expect(fetchMock.calls(reRunQueryEndpoint)).toHaveLength(0);
    setup(mockedProps, store);
    expect(store.getActions()).toHaveLength(1);
    expect(store.getActions()[0].query.errorMessage).toEqual(
      'Your session timed out',
    );
    expect(store.getActions()[0].type).toEqual('START_QUERY');
    await waitFor(() =>
      expect(fetchMock.calls(reRunQueryEndpoint)).toHaveLength(1),
    );
  });

  test('should not call reRunQuery if no error', async () => {
    const query = queries[0];
    const store = mockStore({
      ...initialState,
      user,
      sqlLab: {
        ...initialState.sqlLab,
        queries: {
          [query.id]: query,
        },
      },
    });
    setup(mockedProps, store);
    expect(store.getActions()).toEqual([]);
    expect(fetchMock.calls(reRunQueryEndpoint)).toHaveLength(0);
  });

  test('should render cached query', async () => {
    const store = mockStore(cachedQueryState);
    const { rerender } = setup(
      { ...mockedProps, queryId: cachedQuery.id },
      store,
    );

    // @ts-ignore
    rerender(<ResultSet {...mockedProps} {...newProps} />);
    expect(store.getActions()).toHaveLength(1);
    expect(store.getActions()[0].query.results).toEqual(cachedQuery.results);
    expect(store.getActions()[0].type).toEqual('CLEAR_QUERY_RESULTS');
  });

  test('should render stopped query', async () => {
    await waitFor(() => {
      setup(
        { ...mockedProps, queryId: stoppedQuery.id },
        mockStore(stoppedQueryState),
      );
    });

    const alert = screen.getByRole('alert');
    expect(alert).toBeInTheDocument();
  });

  test('should render running/pending/fetching query', async () => {
    const { getByTestId } = setup(
      { ...mockedProps, queryId: runningQuery.id },
      mockStore(runningQueryState),
    );
    const progressBar = getByTestId('progress-bar');
    expect(progressBar).toBeInTheDocument();
  });

  test('should render fetching w/ 100 progress query', async () => {
    const { getByRole, getByText } = setup(
      mockedProps,
      mockStore(fetchingQueryState),
    );
    const loading = getByRole('status');
    expect(loading).toBeInTheDocument();
    expect(getByText('fetching')).toBeInTheDocument();
  });

  test('should render a failed query with an error message', async () => {
    await waitFor(() => {
      setup(
        { ...mockedProps, queryId: failedQueryWithErrorMessage.id },
        mockStore(failedQueryWithErrorMessageState),
      );
    });

    expect(screen.getByText('Database error')).toBeInTheDocument();
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  });

  test('should render a failed query with an errors object', async () => {
    await waitFor(() => {
      setup(
        { ...mockedProps, queryId: failedQueryWithErrors.id },
        mockStore(failedQueryWithErrorsState),
      );
    });
    expect(screen.getByText('Database error')).toBeInTheDocument();
  });

  test('should render a timeout error with a retrial button', async () => {
    await waitFor(() => {
      setup(
        { ...mockedProps, queryId: failedQueryWithFrontendTimeoutErrors.id },
        mockStore(failedQueryWithTimeoutState),
      );
    });
    expect(
      screen.getByRole('button', { name: /Retry fetching results/i }),
    ).toBeInTheDocument();
  });

  test('renders if there is no limit in query.results but has queryLimit', async () => {
    const query = {
      ...queries[0],
    };
    await waitFor(() => {
      setup(
        mockedProps,
        mockStore({
          ...initialState,
          user,
          sqlLab: {
            ...initialState.sqlLab,
            queries: {
              [query.id]: query,
            },
          },
        }),
      );
    });
    const { getByRole } = setup(mockedProps, mockStore(initialState));
    expect(getByRole('table')).toBeInTheDocument();
  });

  test('renders if there is a limit in query.results but not queryLimit', async () => {
    const props = { ...mockedProps, queryId: queryWithNoQueryLimit.id };
    const { getByRole } = setup(
      props,
      mockStore({
        ...initialState,
        user,
        sqlLab: {
          ...initialState.sqlLab,
          queries: {
            [queryWithNoQueryLimit.id]: queryWithNoQueryLimit,
          },
        },
      }),
    );
    expect(getByRole('table')).toBeInTheDocument();
  });

  test('Async queries - renders "Fetch data preview" button when data preview has no results', () => {
    const asyncRefetchDataPreviewQuery = {
      ...queries[0],
      state: 'success',
      results: undefined,
      isDataPreview: true,
    };
    setup(
      { ...asyncQueryProps, queryId: asyncRefetchDataPreviewQuery.id },
      mockStore({
        ...initialState,
        user,
        sqlLab: {
          ...initialState.sqlLab,
          queries: {
            [asyncRefetchDataPreviewQuery.id]: asyncRefetchDataPreviewQuery,
          },
        },
      }),
    );
    expect(
      screen.getByRole('button', {
        name: /fetch data preview/i,
      }),
    ).toBeVisible();
    expect(screen.queryByRole('table')).toBe(null);
  });

  test('Async queries - renders "Refetch results" button when a query has no results', () => {
    const asyncRefetchResultsTableQuery = {
      ...queries[0],
      state: 'success',
      results: undefined,
      resultsKey: 'async results key',
    };

    setup(
      { ...asyncQueryProps, queryId: asyncRefetchResultsTableQuery.id },
      mockStore({
        ...initialState,
        user,
        sqlLab: {
          ...initialState.sqlLab,
          queries: {
            [asyncRefetchResultsTableQuery.id]: asyncRefetchResultsTableQuery,
          },
        },
      }),
    );
    expect(
      screen.getByRole('button', {
        name: /refetch results/i,
      }),
    ).toBeVisible();
    expect(screen.queryByRole('table')).toBe(null);
  });

  test('Async queries - renders on the first call', () => {
    const query = {
      ...queries[0],
    };
    setup(
      { ...asyncQueryProps, queryId: query.id },
      mockStore({
        ...initialState,
        user,
        sqlLab: {
          ...initialState.sqlLab,
          queries: {
            [query.id]: query,
          },
        },
      }),
    );
    expect(screen.getByRole('table')).toBeVisible();
    expect(
      screen.queryByRole('button', {
        name: /fetch data preview/i,
      }),
    ).toBe(null);
    expect(
      screen.queryByRole('button', {
        name: /refetch results/i,
      }),
    ).toBe(null);
  });

  test('should allow download as CSV when user has permission to export data', async () => {
    const { queryByTestId } = setup(
      mockedProps,
      mockStore({
        ...initialState,
        user: {
          ...user,
          roles: {
            sql_lab: [['can_export_csv', 'SQLLab']],
          },
        },
        sqlLab: {
          ...initialState.sqlLab,
          queries: {
            [queries[0].id]: queries[0],
          },
        },
      }),
    );
    expect(queryByTestId('export-csv-button')).toBeInTheDocument();
  });

  test('should not allow download as CSV when user does not have permission to export data', async () => {
    const { queryByTestId } = setup(
      mockedProps,
      mockStore({
        ...initialState,
        user,
        sqlLab: {
          ...initialState.sqlLab,
          queries: {
            [queries[0].id]: queries[0],
          },
        },
      }),
    );
    expect(queryByTestId('export-csv-button')).not.toBeInTheDocument();
  });

  test('should allow copy to clipboard when user has permission to export data', async () => {
    const { queryByTestId } = setup(
      mockedProps,
      mockStore({
        ...initialState,
        user: {
          ...user,
          roles: {
            sql_lab: [['can_export_csv', 'SQLLab']],
          },
        },
        sqlLab: {
          ...initialState.sqlLab,
          queries: {
            [queries[0].id]: queries[0],
          },
        },
      }),
    );
    expect(queryByTestId('copy-to-clipboard-button')).toBeInTheDocument();
  });

  test('should not allow copy to clipboard when user does not have permission to export data', async () => {
    const { queryByTestId } = setup(
      mockedProps,
      mockStore({
        ...initialState,
        user,
        sqlLab: {
          ...initialState.sqlLab,
          queries: {
            [queries[0].id]: queries[0],
          },
        },
      }),
    );
    expect(queryByTestId('copy-to-clipboard-button')).not.toBeInTheDocument();
  });
});
