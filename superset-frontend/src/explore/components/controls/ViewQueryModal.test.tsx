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

import { screen, render, waitFor } from 'spec/helpers/testing-library';
import fetchMock from 'fetch-mock';
import * as chartAction from 'src/components/Chart/chartAction';
import type { ChartDataRequestResponse } from 'src/components/Chart/chartAction';
import ViewQueryModal from './ViewQueryModal';

const mockFormData = {
  datasource: '1__table',
  viz_type: 'table',
};

// Minimal, type-correct response that satisfies ChartDataRequestResponse.
// A real Response instance avoids the 16 required Response fields that an
// empty object ({}) fails to overlap. The assertions only inspect the call
// arguments, never the resolved value's contents.
const mockChartDataResponse: ChartDataRequestResponse = {
  response: new Response(),
  json: { result: [] },
};

const chartDataEndpoint = 'glob:*/api/v1/chart/data*';

afterEach(() => {
  jest.restoreAllMocks();
  jest.resetAllMocks();
  fetchMock.clearHistory().removeRoutes();
});

test('renders Alert component when query result contains validation error', async () => {
  /**
   * Regression test for issue #35492 - Phase 1
   * Verifies that validation errors from the backend are displayed in an Alert
   * component instead of showing a blank panel
   */
  // Mock API response with validation error
  fetchMock.post(
    chartDataEndpoint,
    {
      result: [
        {
          error: 'Missing temporal column',
          language: 'sql',
        },
      ],
    },
    { name: chartDataEndpoint },
  );

  render(<ViewQueryModal latestQueryFormData={mockFormData} />, {
    useRedux: true,
  });

  // Wait for API call to complete
  await waitFor(() =>
    expect(fetchMock.callHistory.calls(chartDataEndpoint)).toHaveLength(1),
  );

  // Assert Alert component is rendered with error message
  expect(screen.getByRole('alert')).toBeInTheDocument();
  expect(screen.getByText('Missing temporal column')).toBeInTheDocument();
});

test('renders both Alert and SQL query when parsing error occurs', async () => {
  /**
   * Regression test for issue #35492 - Phase 2
   * Verifies that parsing errors (which occur after SQL generation) display
   * both the error message AND the SQL query that failed to parse.
   *
   * This differs from validation errors (Phase 1) where no SQL was generated.
   * For parsing errors, the SQL was successfully compiled but optimization failed.
   */
  // Mock API response with parsing error (has both query and error)
  fetchMock.post(
    chartDataEndpoint,
    {
      result: [
        {
          query: 'SELECT SUM ( Open',
          error: "Error parsing near 'Open' at line 1:17",
          language: 'sql',
        },
      ],
    },
    { name: chartDataEndpoint },
  );

  render(<ViewQueryModal latestQueryFormData={mockFormData} />, {
    useRedux: true,
  });

  // Wait for the error message to appear
  await waitFor(() =>
    expect(
      screen.getByText("Error parsing near 'Open' at line 1:17"),
    ).toBeInTheDocument(),
  );

  // Assert Alert component is rendered with error message
  expect(screen.getByRole('alert')).toBeInTheDocument();

  // Assert SQL query is also displayed
  // Note: The SQL is rendered inside a syntax-highlighted code block where
  // each keyword is in a separate span element
  await waitFor(
    () => {
      expect(screen.getByText('SELECT')).toBeInTheDocument();
      expect(screen.getByText('SUM')).toBeInTheDocument();
      expect(screen.getByText('Open')).toBeInTheDocument();
    },
    { timeout: 5000 },
  );
});

test('passes ownState through to getChartDataRequest', async () => {
  /**
   * Regression test for PR #35208 - the ViewQueryModal must forward the
   * chart's ownState (e.g. table search text, order_by) to the data request
   * so that the displayed SQL reflects the same filters applied to the chart.
   */
  const getChartDataRequestSpy = jest
    .spyOn(chartAction, 'getChartDataRequest')
    .mockResolvedValue(mockChartDataResponse);

  const ownState = { searchText: 'foo', order_by: [['col', 'asc']] };

  render(
    <ViewQueryModal latestQueryFormData={mockFormData} ownState={ownState} />,
    { useRedux: true },
  );

  await waitFor(() => {
    expect(getChartDataRequestSpy).toHaveBeenCalledTimes(1);
  });

  expect(getChartDataRequestSpy).toHaveBeenCalledWith(
    expect.objectContaining({
      formData: mockFormData,
      ownState,
    }),
  );
});

test('strips clientView from ownState before the query request', async () => {
  /**
   * clientView holds the full client-side row/column snapshot (added by
   * TableChart) and is irrelevant to SQL generation. It must be stripped
   * before the request - matching ExploreViewContainer and Dashboard - to
   * avoid bloating the payload (or triggering 413) on large tables.
   */
  const getChartDataRequestSpy = jest
    .spyOn(chartAction, 'getChartDataRequest')
    .mockResolvedValue(mockChartDataResponse);

  const ownState = {
    searchText: 'foo',
    // Simulate a large client-side snapshot that TableChart writes
    clientView: { rows: [{ a: 1 }, { a: 2 }], columns: ['a'] },
  };

  render(
    <ViewQueryModal latestQueryFormData={mockFormData} ownState={ownState} />,
    { useRedux: true },
  );

  await waitFor(() => {
    expect(getChartDataRequestSpy).toHaveBeenCalledTimes(1);
  });

  const calledOwnState = getChartDataRequestSpy.mock.calls[0][0].ownState;
  expect(calledOwnState).not.toHaveProperty('clientView');
  expect(calledOwnState).toEqual(
    expect.objectContaining({ searchText: 'foo' }),
  );
});

test('falls back to empty ownState when prop is omitted', async () => {
  /**
   * Covers the `ownState || {}` fallback branch in ViewQueryModal - when no
   * ownState is provided, the data request must still be called with an empty
   * object rather than undefined, matching getChartDataRequest's contract.
   */
  const getChartDataRequestSpy = jest
    .spyOn(chartAction, 'getChartDataRequest')
    .mockResolvedValue(mockChartDataResponse);

  render(<ViewQueryModal latestQueryFormData={mockFormData} />, {
    useRedux: true,
  });

  await waitFor(() => {
    expect(getChartDataRequestSpy).toHaveBeenCalledTimes(1);
  });

  expect(getChartDataRequestSpy).toHaveBeenCalledWith(
    expect.objectContaining({
      formData: mockFormData,
      ownState: {},
    }),
  );
});
