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
import { render } from '@testing-library/react';
import QueryAutoRefresh, {
  isQueryRunning,
  shouldCheckForQueries,
} from 'src/SqlLab/components/QueryAutoRefresh';
import { successfulQuery, runningQuery } from 'src/SqlLab/fixtures';
import { QueryDictionary } from 'src/SqlLab/types';

// NOTE: The uses of @ts-ignore in this file is to enable testing of bad inputs to verify the
// function / component handles bad data elegantly
describe('QueryAutoRefresh', () => {
  const runningQueries: QueryDictionary = {};
  runningQueries[runningQuery.id] = runningQuery;

  const successfulQueries: QueryDictionary = {};
  successfulQueries[successfulQuery.id] = successfulQuery;

  const refreshQueries = jest.fn();

  const queriesLastUpdate = Date.now();

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

  it('Attempts to refresh when given pending query', () => {
    render(
      <QueryAutoRefresh
        queries={runningQueries}
        refreshQueries={refreshQueries}
        queriesLastUpdate={queriesLastUpdate}
      />,
    );
    setTimeout(() => {
      expect(refreshQueries).toHaveBeenCalled();
    }, 1000);
  });

  it('Does not fail and attempts to refresh when given pending query and invlaid query', () => {
    render(
      <QueryAutoRefresh
        // @ts-ignore
        queries={{ ...runningQueries, g324t: null }}
        refreshQueries={refreshQueries}
        queriesLastUpdate={queriesLastUpdate}
      />,
    );
    setTimeout(() => {
      expect(refreshQueries).toHaveBeenCalled();
    }, 1000);
  });

  it('Does NOT Attempt to refresh when given only completed queries', () => {
    render(
      <QueryAutoRefresh
        queries={successfulQueries}
        refreshQueries={refreshQueries}
        queriesLastUpdate={queriesLastUpdate}
      />,
    );
    setTimeout(() => {
      expect(refreshQueries).not.toHaveBeenCalled();
    }, 1000);
  });
});
