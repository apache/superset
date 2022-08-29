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
import { getMockStoreWithNativeFilters } from 'spec/fixtures/mockStore';
import chartQueries, { sliceId } from 'spec/fixtures/mockChartQueries';
import { QueryFormData, SupersetClient } from '@superset-ui/core';
import fetchMock from 'fetch-mock';
import DrillDetailPane from './DrillDetailPane';

const chart = chartQueries[sliceId];
const setup = (overrides: Record<string, any> = {}) => {
  const store = getMockStoreWithNativeFilters();
  const props = {
    initialFilters: [],
    formData: chart.form_data as unknown as QueryFormData,
    ...overrides,
  };
  return render(<DrillDetailPane {...props} />, {
    useRedux: true,
    store,
  });
};
const waitForRender = (overrides: Record<string, any> = {}) =>
  waitFor(() => setup(overrides));
const samplesEndpoint =
  'end:/datasource/samples?force=false&datasource_type=table&datasource_id=7&per_page=50&page=1';
const fetchWithNoData = () =>
  fetchMock.post(samplesEndpoint, {
    result: {
      total_count: 0,
      data: [],
      colnames: [],
      coltypes: [],
    },
  });
const fetchWithData = () =>
  fetchMock.post(samplesEndpoint, {
    result: {
      total_count: 3,
      data: [
        {
          year: 1996,
          na_sales: 11.27,
          eu_sales: 8.89,
        },
        {
          year: 1989,
          na_sales: 23.2,
          eu_sales: 2.26,
        },
        {
          year: 1999,
          na_sales: 9,
          eu_sales: 6.18,
        },
      ],
      colnames: ['year', 'na_sales', 'eu_sales'],
      coltypes: [0, 0, 0],
    },
  });
const SupersetClientPost = jest.spyOn(SupersetClient, 'post');

afterEach(fetchMock.restore);

test('should render', async () => {
  fetchWithNoData();
  const { container } = await waitForRender();
  expect(container).toBeInTheDocument();
});

test('should render the loading component', async () => {
  fetchWithData();
  setup();
  await waitFor(() => {
    expect(screen.getByRole('status', { name: 'Loading' })).toBeInTheDocument();
  });
});

test('should render the table with results', async () => {
  fetchWithData();
  await waitForRender();
  expect(screen.getByRole('table')).toBeInTheDocument();
  expect(screen.getAllByRole('row')).toHaveLength(4);
  expect(
    screen.getByRole('columnheader', { name: 'year' }),
  ).toBeInTheDocument();
  expect(
    screen.getByRole('columnheader', { name: 'na_sales' }),
  ).toBeInTheDocument();
  expect(
    screen.getByRole('columnheader', { name: 'eu_sales' }),
  ).toBeInTheDocument();
});

test('should render the "No results" components', async () => {
  fetchWithNoData();
  setup();
  expect(
    await screen.findByText('No rows were returned for this dataset'),
  ).toBeInTheDocument();
});

test('should render the error', async () => {
  SupersetClientPost.mockRejectedValue(new Error('Something went wrong'));
  await waitForRender();
  expect(screen.getByText('Error: Something went wrong')).toBeInTheDocument();
});
