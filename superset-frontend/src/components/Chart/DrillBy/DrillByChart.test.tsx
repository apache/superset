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
import chartQueries, { sliceId } from 'spec/fixtures/mockChartQueries';
import fetchMock from 'fetch-mock';
import DrillByChart from './DrillByChart';

const CHART_DATA_ENDPOINT =
  'glob:*api/v1/chart/data?form_data=%7B%22slice_id%22%3A18%7D';

const chart = chartQueries[sliceId];

const fetchWithNoData = () => {
  fetchMock.post(CHART_DATA_ENDPOINT, {
    result: [
      {
        total_count: 0,
        data: [],
        colnames: [],
        coltypes: [],
      },
    ],
  });
};

const setup = (overrides: Record<string, any> = {}) =>
  render(<DrillByChart formData={{ ...chart.form_data, ...overrides }} />, {
    useRedux: true,
  });

const waitForRender = (overrides: Record<string, any> = {}) =>
  waitFor(() => setup(overrides));

afterEach(fetchMock.restore);

test('should render', async () => {
  fetchWithNoData();
  const { container } = await waitForRender();
  expect(container).toBeInTheDocument();
});

test('should render loading indicator', async () => {
  setup();
  await waitFor(() =>
    expect(screen.getByLabelText('Loading')).toBeInTheDocument(),
  );
});

test('should render the "No results" components', async () => {
  fetchWithNoData();
  setup();
  expect(await screen.findByText('No Results')).toBeInTheDocument();
});
