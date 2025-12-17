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
import { QueryFormData } from '@superset-ui/core';
import { fetchChartFormData } from '.';

const CHART_ID = 123;
const MOCK_FORM_DATA = {
  datasource: '1__table',
  viz_type: 'big_number_total',
  slice_id: CHART_ID,
  metric: {
    expressionType: 'SIMPLE',
    column: { id: 1, column_name: 'count' },
    aggregate: 'COUNT_DISTINCT',
  },
};

test('should fetch chart form_data from API', async () => {
  const endpoint = `glob:*/api/v1/chart/${CHART_ID}*`;
  fetchMock.get(
    endpoint,
    {
      result: {
        params: JSON.stringify(MOCK_FORM_DATA),
      },
    },
    { overwriteRoutes: true },
  );

  const formData = await fetchChartFormData(CHART_ID);

  expect(formData).toEqual(MOCK_FORM_DATA);
  expect(fetchMock.calls(endpoint)).toHaveLength(1);

  fetchMock.restore();
});

test('should include params query parameter', async () => {
  const endpoint = `glob:*/api/v1/chart/${CHART_ID}*`;
  fetchMock.get(
    endpoint,
    {
      result: {
        params: JSON.stringify(MOCK_FORM_DATA),
      },
    },
    { overwriteRoutes: true },
  );

  await fetchChartFormData(CHART_ID);

  const calls = fetchMock.calls(endpoint);
  expect(calls[0][0]).toContain('columns');
  expect(calls[0][0]).toContain('params');

  fetchMock.restore();
});

test('should throw error when API call fails', async () => {
  const endpoint = `glob:*/api/v1/chart/${CHART_ID}*`;
  fetchMock.get(
    endpoint,
    { throws: new Error('Internal Server Error') },
    { overwriteRoutes: true },
  );

  await expect(fetchChartFormData(CHART_ID)).rejects.toThrow();

  fetchMock.restore();
});

test('should parse JSON params correctly', async () => {
  const complexFormData = {
    ...MOCK_FORM_DATA,
    adhoc_filters: [
      {
        clause: 'WHERE',
        subject: 'name',
        operator: '==',
        comparator: 'test',
      },
    ],
  };

  const endpoint = `glob:*/api/v1/chart/${CHART_ID}*`;
  fetchMock.get(
    endpoint,
    {
      result: {
        params: JSON.stringify(complexFormData),
      },
    },
    { overwriteRoutes: true },
  );

  const formData = (await fetchChartFormData(CHART_ID)) as QueryFormData;

  expect(formData).toEqual(complexFormData);
  expect(formData.adhoc_filters).toHaveLength(1);

  fetchMock.restore();
});
