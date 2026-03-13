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
import { type ReactChild } from 'react';
import {
  render,
  screen,
  waitFor,
  fireEvent,
  within,
} from 'spec/helpers/testing-library';
import configureStore from 'redux-mock-store';
import { Store } from 'redux';
import thunk from 'redux-thunk';
import fetchMock from 'fetch-mock';
import { setupAGGridModules } from '@superset-ui/core/components/ThemedAgGridReact';
import ResultSet from 'src/SqlLab/components/ResultSet';
import * as getBootstrapData from 'src/utils/getBootstrapData';
import {
  cachedQuery,
  failedQueryWithErrors,
  queries,
  stoppedQuery,
  initialState,
  user,
  queryWithNoQueryLimit,
  failedQueryWithFrontendTimeoutErrors,
} from 'src/SqlLab/fixtures';

jest.mock('src/components/ErrorMessage', () => ({
  ErrorMessageWithStackTrace: () => <div data-test="error-message">Error</div>,
}));

// Mock useStreamingExport to capture startExport calls
const mockStartExport = jest.fn();
const mockResetExport = jest.fn();
const mockCancelExport = jest.fn();
jest.mock('src/components/StreamingExportModal/useStreamingExport', () => ({
  useStreamingExport: () => ({
    startExport: mockStartExport,
    resetExport: mockResetExport,
    cancelExport: mockCancelExport,
    progress: { status: 'streaming', rowsProcessed: 0 },
  }),
}));

jest.mock(
  'react-virtualized-auto-sizer',
  () =>
    ({ children }: { children: (params: { height: number }) => ReactChild }) =>
      children({ height: 500 }),
);
const applicationRootMock = jest.spyOn(getBootstrapData, 'applicationRoot');

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
const cachedQueryState = {
  ...initialState,
  sqlLab: {
    ...initialState.sqlLab,
    queries: {
      [cachedQuery.id]: cachedQuery,
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
  fetchMock.clearHistory();
});

const middlewares = [thunk];
const mockStore = configureStore(middlewares);
const setup = (props?: any, store?: Store) =>
  render(<ResultSet {...props} />, {
    useRedux: true,
    ...(store && { store }),
  });

// eslint-disable-next-line no-restricted-globals -- TODO: Migrate from describe blocks
describe('ResultSet', () => {
  beforeAll(() => {
    setupAGGridModules();
  });

  beforeEach(() => {
    applicationRootMock.mockReturnValue('');
    mockStartExport.mockClear();
  });

  // Add cleanup after each test
  afterEach(async () => {
    fetchMock.clearHistory();
    // Wait for any pending effects to complete
    await new Promise(resolve => setTimeout(resolve, 0));
  });

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
    await waitFor(() => {
      const table = getByTestId('table-container');
      expect(table).toBeInTheDocument();
    });
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

    expect(fetchMock.callHistory.calls(reRunQueryEndpoint)).toHaveLength(0);
    setup(mockedProps, store);
    expect(store.getActions()).toHaveLength(1);
    expect(store.getActions()[0].query.errorMessage).toEqual(
      'Your session timed out',
    );
    expect(store.getActions()[0].type).toEqual('START_QUERY');
    await waitFor(() =>
      expect(fetchMock.callHistory.calls(reRunQueryEndpoint)).toHaveLength(1),
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
    expect(fetchMock.callHistory.calls(reRunQueryEndpoint)).toHaveLength(0);
  });

  test('should render cached query', async () => {
    const store = mockStore(cachedQueryState);
    const { rerender } = setup(
      { ...mockedProps, queryId: cachedQuery.id },
      store,
    );

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

  test('should render a failed query with an errors object', async () => {
    const { errors } = failedQueryWithErrors;

    await waitFor(() => {
      setup(
        { ...mockedProps, queryId: failedQueryWithErrors.id },
        mockStore(failedQueryWithErrorsState),
      );
    });
    const errorMessages = screen.getAllByTestId('error-message');
    expect(errorMessages).toHaveLength(errors.length);
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
    expect(getByRole('grid')).toBeInTheDocument();
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
    expect(getByRole('grid')).toBeInTheDocument();
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
    expect(screen.queryByRole('grid')).not.toBeInTheDocument();
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
    expect(screen.queryByRole('grid')).not.toBeInTheDocument();
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
    expect(screen.getByRole('grid')).toBeVisible();
    expect(
      screen.queryByRole('button', {
        name: /fetch data preview/i,
      }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', {
        name: /refetch results/i,
      }),
    ).not.toBeInTheDocument();
  });

  test.each(['', '/myapp'])(
    'should allow download as CSV when user has permission to export data with app_root=%s',
    async app_root => {
      applicationRootMock.mockReturnValue(app_root);
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
      const export_csv_button = screen.getByTestId('export-csv-button');
      expect(export_csv_button).toHaveAttribute(
        'href',
        expect.stringMatching(
          new RegExp(`^${app_root}/api/v1/sqllab/export/[a-zA-Z0-9]+/$`),
        ),
      );
    },
  );

  test('should display a popup message when the CSV content is limited to the dropdown limit', async () => {
    const queryLimit = 2;
    const { getByTestId, findByRole } = setup(
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
            [queries[0].id]: {
              ...queries[0],
              limitingFactor: 'DROPDOWN',
              queryLimit,
            },
          },
        },
      }),
    );

    await waitFor(() => {
      const downloadButton = getByTestId('export-csv-button');
      expect(downloadButton).toBeInTheDocument();
    });

    const downloadButton = getByTestId('export-csv-button');
    await waitFor(() => fireEvent.click(downloadButton));

    const warningModal = await findByRole('dialog');
    await waitFor(() => {
      expect(
        within(warningModal).getByText(`Download is on the way`),
      ).toBeInTheDocument();
    });
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

  test('should include sqlEditorImmutableId in query object when fetching results', async () => {
    const queryWithResultsKey = {
      ...queries[0],
      resultsKey: 'test-results-key',
      sqlEditorImmutableId: 'test-immutable-id-123',
    };

    const store = mockStore({
      ...initialState,
      user,
      sqlLab: {
        ...initialState.sqlLab,
        queries: {
          [queryWithResultsKey.id]: queryWithResultsKey,
        },
      },
    });

    setup({ ...mockedProps, queryId: queryWithResultsKey.id }, store);

    await waitFor(() => {
      // Check that REQUEST_QUERY_RESULTS action was dispatched
      const actions = store.getActions();
      const requestAction = actions.find(
        action => action.type === 'REQUEST_QUERY_RESULTS',
      );
      expect(requestAction).toBeDefined();
      // Verify sqlEditorImmutableId is present in the query object
      expect(requestAction?.query?.sqlEditorImmutableId).toBe(
        'test-immutable-id-123',
      );
    });

    // Verify the API was called
    const resultsCalls = fetchMock.callHistory.calls(
      'glob:*/api/v1/sqllab/results/*',
    );
    expect(resultsCalls).toHaveLength(1);
  });

  test('should use non-streaming export (href) when rows below threshold', async () => {
    // This test validates that when rows < CSV_STREAMING_ROW_THRESHOLD,
    // the component uses the direct download href instead of streaming export.
    const appRoot = '/superset';
    applicationRootMock.mockReturnValue(appRoot);

    // Create a query with rows BELOW the threshold
    const smallQuery = {
      ...queries[0],
      rows: 500, // Below the 1000 threshold
      limitingFactor: 'NOT_LIMITED',
    };

    const { getByTestId } = setup(
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
            [smallQuery.id]: smallQuery,
          },
        },
        common: {
          conf: {
            CSV_STREAMING_ROW_THRESHOLD: 1000,
          },
        },
      }),
    );

    await waitFor(() => {
      expect(getByTestId('export-csv-button')).toBeInTheDocument();
    });

    const exportButton = getByTestId('export-csv-button');

    // Non-streaming export should have href attribute with prefixed URL
    expect(exportButton).toHaveAttribute(
      'href',
      expect.stringMatching(new RegExp(`^${appRoot}/api/v1/sqllab/export/`)),
    );

    // Click should NOT trigger startExport for non-streaming
    fireEvent.click(exportButton);
    expect(mockStartExport).not.toHaveBeenCalled();
  });

  test.each([
    {
      name: 'no prefix (default deployment)',
      appRoot: '',
      expectedUrl: '/api/v1/sqllab/export_streaming/',
    },
    {
      name: 'with subdirectory prefix',
      appRoot: '/superset',
      expectedUrl: '/superset/api/v1/sqllab/export_streaming/',
    },
    {
      name: 'with nested subdirectory prefix',
      appRoot: '/my-app/superset',
      expectedUrl: '/my-app/superset/api/v1/sqllab/export_streaming/',
    },
  ])(
    'streaming export URL respects app root configuration: $name',
    async ({ appRoot, expectedUrl }) => {
      // This test validates that streaming export startExport receives the correct URL
      // based on the applicationRoot configuration.
      applicationRootMock.mockReturnValue(appRoot);

      // Create a query with enough rows to trigger streaming export (>= threshold)
      const largeQuery = {
        ...queries[0],
        rows: 5000, // Above the default 1000 threshold
        limitingFactor: 'NOT_LIMITED',
      };

      const { getByTestId } = setup(
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
              [largeQuery.id]: largeQuery,
            },
          },
          common: {
            conf: {
              CSV_STREAMING_ROW_THRESHOLD: 1000,
            },
          },
        }),
      );

      await waitFor(() => {
        expect(getByTestId('export-csv-button')).toBeInTheDocument();
      });

      const exportButton = getByTestId('export-csv-button');
      fireEvent.click(exportButton);

      // Verify startExport was called exactly once
      expect(mockStartExport).toHaveBeenCalledTimes(1);

      // The URL should match the expected prefixed URL
      expect(mockStartExport).toHaveBeenCalledWith(
        expect.objectContaining({
          url: expectedUrl,
        }),
      );
    },
  );
});
