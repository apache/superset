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
import React from 'react';
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
} from 'src/SqlLab/fixtures';

const mockedProps = {
  cache: true,
  query: queries[0],
  height: 140,
  database: { allows_virtual_table_explore: true },
  user,
  defaultQueryLimit: 1000,
};
const stoppedQueryProps = { ...mockedProps, query: stoppedQuery };
const runningQueryProps = { ...mockedProps, query: runningQuery };
const fetchingQueryProps = {
  ...mockedProps,
  query: {
    dbId: 1,
    cached: false,
    ctas: false,
    id: 'ryhHUZCGb',
    progress: 100,
    state: 'fetching',
    startDttm: Date.now() - 500,
  },
};
const cachedQueryProps = { ...mockedProps, query: cachedQuery };
const failedQueryWithErrorMessageProps = {
  ...mockedProps,
  query: failedQueryWithErrorMessage,
};
const failedQueryWithErrorsProps = {
  ...mockedProps,
  query: failedQueryWithErrors,
};
const newProps = {
  query: {
    cached: false,
    resultsKey: 'new key',
    results: {
      data: [{ a: 1 }],
    },
  },
};
const asyncQueryProps = {
  ...mockedProps,
  database: { allow_run_async: true },
};
const asyncRefetchDataPreviewProps = {
  ...asyncQueryProps,
  query: {
    state: 'success',
    results: undefined,
    isDataPreview: true,
  },
};
const asyncRefetchResultsTableProps = {
  ...asyncQueryProps,
  query: {
    state: 'success',
    results: undefined,
    resultsKey: 'async results key',
  },
};
fetchMock.get('glob:*/api/v1/dataset/?*', { result: [] });

const middlewares = [thunk];
const mockStore = configureStore(middlewares);
const setup = (props?: any, store?: Store) =>
  render(<ResultSet {...props} />, {
    useRedux: true,
    ...(store && { store }),
  });

describe('ResultSet', () => {
  test('renders a Table', async () => {
    const { getByTestId } = setup(mockedProps, mockStore(initialState));
    const table = getByTestId('table-container');
    expect(table).toBeInTheDocument();
  });

  test('should render success query', async () => {
    const { queryAllByText, getByTestId } = setup(
      mockedProps,
      mockStore(initialState),
    );

    const table = getByTestId('table-container');
    expect(table).toBeInTheDocument();

    const firstColumn = queryAllByText(
      mockedProps.query.results?.columns[0].column_name ?? '',
    )[0];
    const secondColumn = queryAllByText(
      mockedProps.query.results?.columns[1].column_name ?? '',
    )[0];
    expect(firstColumn).toBeInTheDocument();
    expect(secondColumn).toBeInTheDocument();

    const exploreButton = getByTestId('explore-results-button');
    expect(exploreButton).toBeInTheDocument();
  });

  test('should render empty results', async () => {
    const props = {
      ...mockedProps,
      query: { ...mockedProps.query, results: { data: [] } },
    };
    await waitFor(() => {
      setup(props, mockStore(initialState));
    });

    const alert = screen.getByRole('alert');
    expect(alert).toBeInTheDocument();
    expect(alert).toHaveTextContent('The query returned no data');
  });

  test('should call reRunQuery if timed out', async () => {
    const store = mockStore(initialState);
    const propsWithError = {
      ...mockedProps,
      query: { ...queries[0], errorMessage: 'Your session timed out' },
    };

    setup(propsWithError, store);
    expect(store.getActions()).toHaveLength(1);
    expect(store.getActions()[0].query.errorMessage).toEqual(
      'Your session timed out',
    );
    expect(store.getActions()[0].type).toEqual('START_QUERY');
  });

  test('should not call reRunQuery if no error', async () => {
    const store = mockStore(initialState);
    setup(mockedProps, store);
    expect(store.getActions()).toEqual([]);
  });

  test('should render cached query', async () => {
    const store = mockStore(initialState);
    const { rerender } = setup(cachedQueryProps, store);

    // @ts-ignore
    rerender(<ResultSet {...newProps} />);
    expect(store.getActions()).toHaveLength(2);
    expect(store.getActions()[0].query.results).toEqual(
      cachedQueryProps.query.results,
    );
    expect(store.getActions()[0].type).toEqual('CLEAR_QUERY_RESULTS');
  });

  test('should render stopped query', async () => {
    await waitFor(() => {
      setup(stoppedQueryProps, mockStore(initialState));
    });

    const alert = screen.getByRole('alert');
    expect(alert).toBeInTheDocument();
  });

  test('should render running/pending/fetching query', async () => {
    const { getByTestId } = setup(runningQueryProps, mockStore(initialState));
    const progressBar = getByTestId('progress-bar');
    expect(progressBar).toBeInTheDocument();
  });

  test('should render fetching w/ 100 progress query', async () => {
    const { getByRole, getByText } = setup(
      fetchingQueryProps,
      mockStore(initialState),
    );
    const loading = getByRole('status');
    expect(loading).toBeInTheDocument();
    expect(getByText('fetching')).toBeInTheDocument();
  });

  test('should render a failed query with an error message', async () => {
    await waitFor(() => {
      setup(failedQueryWithErrorMessageProps, mockStore(initialState));
    });

    expect(screen.getByText('Database error')).toBeInTheDocument();
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  });

  test('should render a failed query with an errors object', async () => {
    await waitFor(() => {
      setup(failedQueryWithErrorsProps, mockStore(initialState));
    });
    expect(screen.getByText('Database error')).toBeInTheDocument();
  });

  test('renders if there is no limit in query.results but has queryLimit', async () => {
    const { getByRole } = setup(mockedProps, mockStore(initialState));
    expect(getByRole('table')).toBeInTheDocument();
  });

  test('renders if there is a limit in query.results but not queryLimit', async () => {
    const props = { ...mockedProps, query: queryWithNoQueryLimit };
    const { getByRole } = setup(props, mockStore(initialState));
    expect(getByRole('table')).toBeInTheDocument();
  });

  test('Async queries - renders "Fetch data preview" button when data preview has no results', () => {
    setup(asyncRefetchDataPreviewProps, mockStore(initialState));
    expect(
      screen.getByRole('button', {
        name: /fetch data preview/i,
      }),
    ).toBeVisible();
    expect(screen.queryByRole('grid')).toBe(null);
  });

  test('Async queries - renders "Refetch results" button when a query has no results', () => {
    setup(asyncRefetchResultsTableProps, mockStore(initialState));
    expect(
      screen.getByRole('button', {
        name: /refetch results/i,
      }),
    ).toBeVisible();
    expect(screen.queryByRole('grid')).toBe(null);
  });

  test('Async queries - renders on the first call', () => {
    setup(asyncQueryProps, mockStore(initialState));
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
});
