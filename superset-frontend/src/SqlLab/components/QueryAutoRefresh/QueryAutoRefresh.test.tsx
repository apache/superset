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
import configureStore from 'redux-mock-store';
import thunk from 'redux-thunk';
import { render, waitFor } from 'spec/helpers/testing-library';
import {
  CLEAR_INACTIVE_QUERIES,
  REFRESH_QUERIES,
} from 'src/SqlLab/actions/sqlLab';
import QueryAutoRefresh, {
  isQueryRunning,
  shouldCheckForQueries,
  QUERY_UPDATE_FREQ,
} from 'src/SqlLab/components/QueryAutoRefresh';
import { successfulQuery, runningQuery } from 'src/SqlLab/fixtures';
import { QueryDictionary } from 'src/SqlLab/types';

const middlewares = [thunk];
const mockStore = configureStore(middlewares);

// NOTE: The uses of @ts-ignore in this file is to enable testing of bad inputs to verify the
// function / component handles bad data elegantly
describe('QueryAutoRefresh', () => {
  const runningQueries: QueryDictionary = {};
  runningQueries[runningQuery.id] = runningQuery;

  const successfulQueries: QueryDictionary = {};
  successfulQueries[successfulQuery.id] = successfulQuery;

  const queriesLastUpdate = Date.now();

  const refreshApi = 'glob:*/api/v1/query/updated_since?*';

  afterEach(() => {
    fetchMock.reset();
  });

  it('isQueryRunning returns true for valid running query', () => {
    const running = isQueryRunning(runningQuery);
    expect(running).toBe(true);
  });

  it('isQueryRunning returns false for valid not-running query', () => {
    const running = isQueryRunning(successfulQuery);
    expect(running).toBe(false);
  });

  it('isQueryRunning returns false for invalid query', () => {
    // @ts-ignore
    let running = isQueryRunning(null);
    expect(running).toBe(false);
    // @ts-ignore
    running = isQueryRunning(undefined);
    expect(running).toBe(false);
    // @ts-ignore
    running = isQueryRunning('I Should Be An Object');
    expect(running).toBe(false);
    // @ts-ignore
    running = isQueryRunning({ state: { badFormat: true } });
    expect(running).toBe(false);
  });

  it('shouldCheckForQueries is true for valid running query', () => {
    expect(shouldCheckForQueries(runningQueries)).toBe(true);
  });

  it('shouldCheckForQueries is false for valid completed query', () => {
    expect(shouldCheckForQueries(successfulQueries)).toBe(false);
  });

  it('shouldCheckForQueries is false for invalid inputs', () => {
    // @ts-ignore
    expect(shouldCheckForQueries(null)).toBe(false);
    // @ts-ignore
    expect(shouldCheckForQueries(undefined)).toBe(false);
    expect(
      // @ts-ignore
      shouldCheckForQueries({
        // @ts-ignore
        '1234': null,
        // @ts-ignore
        '23425': 'hello world',
        // @ts-ignore
        '345': [],
        // @ts-ignore
        '57346': undefined,
      }),
    ).toBe(false);
  });

  it('Attempts to refresh when given pending query', async () => {
    const store = mockStore();
    fetchMock.get(refreshApi, {
      result: [
        {
          id: runningQuery.id,
          status: 'success',
        },
      ],
    });

    render(
      <QueryAutoRefresh
        queries={runningQueries}
        queriesLastUpdate={queriesLastUpdate}
      />,
      { useRedux: true, store },
    );
    await waitFor(
      () =>
        expect(store.getActions()).toContainEqual(
          expect.objectContaining({
            type: REFRESH_QUERIES,
          }),
        ),
      { timeout: QUERY_UPDATE_FREQ + 100 },
    );
  });

  it('Attempts to clear inactive queries when updated queries are empty', async () => {
    const store = mockStore();
    fetchMock.get(refreshApi, {
      result: [],
    });

    render(
      <QueryAutoRefresh
        queries={runningQueries}
        queriesLastUpdate={queriesLastUpdate}
      />,
      { useRedux: true, store },
    );
    await waitFor(
      () =>
        expect(store.getActions()).toContainEqual(
          expect.objectContaining({
            type: CLEAR_INACTIVE_QUERIES,
          }),
        ),
      { timeout: QUERY_UPDATE_FREQ + 100 },
    );
    expect(
      store.getActions().filter(({ type }) => type === REFRESH_QUERIES),
    ).toHaveLength(0);
    expect(fetchMock.calls(refreshApi)).toHaveLength(1);
  });

  it('Does not fail and attempts to refresh when given pending query and invlaid query', async () => {
    const store = mockStore();
    fetchMock.get(refreshApi, {
      result: [
        {
          id: runningQuery.id,
          status: 'success',
        },
      ],
    });

    render(
      <QueryAutoRefresh
        // @ts-ignore
        queries={{ ...runningQueries, g324t: null }}
        queriesLastUpdate={queriesLastUpdate}
      />,
      { useRedux: true, store },
    );
    await waitFor(
      () =>
        expect(store.getActions()).toContainEqual(
          expect.objectContaining({
            type: REFRESH_QUERIES,
          }),
        ),
      { timeout: QUERY_UPDATE_FREQ + 100 },
    );
  });

  it('Does NOT Attempt to refresh when given only completed queries', async () => {
    const store = mockStore();
    fetchMock.get(refreshApi, {
      result: [
        {
          id: runningQuery.id,
          status: 'success',
        },
      ],
    });
    render(
      <QueryAutoRefresh
        queries={successfulQueries}
        queriesLastUpdate={queriesLastUpdate}
      />,
      { useRedux: true, store },
    );
    await waitFor(
      () =>
        expect(store.getActions()).toContainEqual(
          expect.objectContaining({
            type: CLEAR_INACTIVE_QUERIES,
          }),
        ),
      { timeout: QUERY_UPDATE_FREQ + 100 },
    );
    expect(fetchMock.calls(refreshApi)).toHaveLength(0);
  });
});
