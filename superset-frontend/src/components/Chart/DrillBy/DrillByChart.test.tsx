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
const fetchWithData = () => {
  fetchMock.post(CHART_DATA_ENDPOINT, {
    result: [
      {
        cache_key: 'caaaf4408f8f440ac1c8fedc857d4e84',
        cached_dttm: null,
        cache_timeout: 300,
        applied_template_filters: [],
        annotation_data: {},
        error: null,
        is_cached: null,
        query:
          "SELECT num_girls AS num_girls,\n       SUM(num) AS sum__num\nFROM public.birth_names\nWHERE ds >= TO_TIMESTAMP('1923-04-01 00:00:00.000000', 'YYYY-MM-DD HH24:MI:SS.US')\n  AND ds < TO_TIMESTAMP('2023-04-01 00:40:03.000000', 'YYYY-MM-DD HH24:MI:SS.US')\n  AND gender = 'boy'\nGROUP BY num_girls\nORDER BY sum__num DESC\nLIMIT 50000;\n\n",
        status: 'success',
        stacktrace: null,
        rowcount: 1,
        from_dttm: -1475452800000,
        to_dttm: 1680309603000,
        label_map: {
          num_girls: ['num_girls'],
          sum__num: ['sum__num'],
        },
        colnames: ['num_girls', 'sum__num'],
        indexnames: [0],
        coltypes: [0, 0],
        data: [
          {
            num_girls: 0,
            sum__num: 48133355,
          },
        ],
        result_format: 'json',
        applied_filters: [
          {
            column: 'gender',
          },
        ],
        rejected_filters: [],
      },
    ],
  });
};

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

const setup = (overrides: Record<string, any> = {}) => {
  const props = {
    filters: [],
    column: { column_name: 'name' },
    formData: chart.form_data,
    groupbyFieldName: '',
    ...overrides,
  };
  return render(<DrillByChart {...props} />, {
    useRedux: true,
  });
};

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

// test('should render SuperChart', async () => {
//   fetchWithData();
//   await waitForRender();
//   screen.logTestingPlaygroundURL();
//   expect(await screen.findByText('other')).toBeInTheDocument();
// });
