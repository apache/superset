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
import chartReducer, { chart } from 'src/components/Chart/chartReducer';
import * as actions from 'src/components/Chart/chartAction';

// eslint-disable-next-line no-restricted-globals -- TODO: Migrate from describe blocks
describe('chart reducers', () => {
  const chartKey = 1;
  let testChart;
  let charts;
  beforeEach(() => {
    testChart = {
      ...chart,
      id: chartKey,
    };
    charts = { [chartKey]: testChart };
  });

  test('should update endtime on fail', () => {
    const newState = chartReducer(charts, actions.chartUpdateStopped(chartKey));
    expect(newState[chartKey].chartUpdateEndTime).toBeGreaterThan(0);
    expect(newState[chartKey].chartStatus).toEqual('stopped');
  });

  test('should update endtime on timeout', () => {
    const newState = chartReducer(
      charts,
      actions.chartUpdateFailed(
        {
          statusText: 'timeout',
          error: 'Request timed out',
          errors: [
            {
              error_type: 'FRONTEND_TIMEOUT_ERROR',
              extra: { timeout: 1 },
              level: 'error',
              message: 'Request timed out',
            },
          ],
        },
        chartKey,
      ),
    );
    expect(newState[chartKey].chartUpdateEndTime).toBeGreaterThan(0);
    expect(newState[chartKey].chartStatus).toEqual('failed');
  });

  test('should update form_data on chart update success', () => {
    const latestQueryFormData = {
      datasource: '1__table',
      viz_type: 'big_number_total',
      slice_id: chartKey,
      metric: { aggregate: 'COUNT_DISTINCT' },
    };

    const queriesResponse = [
      {
        data: [{ 'COUNT_DISTINCT(column)': 42 }],
        colnames: ['COUNT_DISTINCT(column)'],
        coltypes: [0],
      },
    ];

    const chartWithLatestFormData = {
      ...testChart,
      latestQueryFormData,
      form_data: { datasource: '1__table', viz_type: 'big_number_total' },
    };

    const chartsWithFormData = { [chartKey]: chartWithLatestFormData };

    const newState = chartReducer(
      chartsWithFormData,
      actions.chartUpdateSucceeded(queriesResponse, chartKey),
    );

    expect(newState[chartKey].chartStatus).toEqual('success');
    expect(newState[chartKey].queriesResponse).toEqual(queriesResponse);
    expect(newState[chartKey].form_data).toEqual(latestQueryFormData);
    expect(newState[chartKey].chartUpdateEndTime).toBeGreaterThan(0);
  });

  test('should sync form_data with latestQueryFormData after refresh', () => {
    const oldFormData = {
      datasource: '1__table',
      viz_type: 'big_number_total',
      metric: { aggregate: 'COUNT' },
    };

    const newFormData = {
      datasource: '1__table',
      viz_type: 'big_number_total',
      metric: { aggregate: 'MAX' },
    };

    const chartWithOldFormData = {
      ...testChart,
      latestQueryFormData: newFormData,
      form_data: oldFormData,
    };

    const chartsWithOldFormData = { [chartKey]: chartWithOldFormData };

    const newState = chartReducer(
      chartsWithOldFormData,
      actions.chartUpdateSucceeded([], chartKey),
    );

    expect(newState[chartKey].form_data).toEqual(newFormData);
    expect(newState[chartKey].form_data.metric.aggregate).toBe('MAX');
  });
});

test('UPDATE_CHART_FORM_DATA updates both form_data and latestQueryFormData for cross-tab sync', () => {
  const chartKey = 1;
  const testChart = {
    ...chart,
    id: chartKey,
  };

  const oldFormData = {
    datasource: '1__table',
    viz_type: 'big_number_total',
    metric: { aggregate: 'MIN' },
  };

  const updatedFormData = {
    datasource: '1__table',
    viz_type: 'big_number_total',
    metric: { aggregate: 'MAX' },
  };

  const chartWithOldData = {
    ...testChart,
    form_data: oldFormData,
    latestQueryFormData: oldFormData,
  };

  const chartsState = { [chartKey]: chartWithOldData };

  const newState = chartReducer(chartsState, {
    type: actions.UPDATE_CHART_FORM_DATA,
    chartId: chartKey,
    formData: updatedFormData,
  });

  expect(newState[chartKey].form_data).toEqual(updatedFormData);
  expect(newState[chartKey].latestQueryFormData).toEqual(updatedFormData);
  expect(newState[chartKey].form_data.metric.aggregate).toBe('MAX');
});
