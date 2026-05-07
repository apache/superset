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
import ViewQueryModal from './ViewQueryModal';

const mockFormData = {
  datasource: '1__table',
  viz_type: 'table',
};

const chartDataEndpoint = 'glob:*/api/v1/chart/data*';

afterEach(() => {
  jest.resetAllMocks();
  fetchMock.restore();
});

test('renders Alert component when query result contains validation error', async () => {
  /**
   * Regression test for issue #35492 - Phase 1
   * Verifies that validation errors from the backend are displayed in an Alert
   * component instead of showing a blank panel
   */
  // Mock API response with validation error
  fetchMock.post(chartDataEndpoint, {
    result: [
      {
        error: 'Missing temporal column',
        language: 'sql',
      },
    ],
  });

  render(<ViewQueryModal latestQueryFormData={mockFormData} />, {
    useRedux: true,
  });

  // Wait for API call to complete
  await waitFor(() =>
    expect(fetchMock.calls(chartDataEndpoint)).toHaveLength(1),
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
  fetchMock.post(chartDataEndpoint, {
    result: [
      {
        query: 'SELECT SUM ( Open',
        error: "Error parsing near 'Open' at line 1:17",
        language: 'sql',
      },
    ],
  });

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
  await waitFor(() => {
    expect(screen.getByText('SELECT')).toBeInTheDocument();
    expect(screen.getByText('SUM')).toBeInTheDocument();
    expect(screen.getByText('Open')).toBeInTheDocument();
  });
});
