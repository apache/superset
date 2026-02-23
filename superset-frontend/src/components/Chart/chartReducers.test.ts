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
import { JsonObject } from '@superset-ui/core';
import chartReducer, { chart } from 'src/components/Chart/chartReducer';
import * as actions from 'src/components/Chart/chartAction';
import { ChartState } from 'src/explore/types';

const CHART_KEY = 1;

// Helper function to create initial chart state
const createChartState = (overrides: Partial<ChartState> = {}) => ({
  [CHART_KEY]: {
    ...chart,
    id: CHART_KEY,
    ...overrides,
  },
});

test('chartReducer updates endtime and status when chart update is stopped', () => {
  const charts = createChartState();

  const newState = chartReducer(charts, actions.chartUpdateStopped(CHART_KEY));

  expect(newState[CHART_KEY].chartUpdateEndTime).toBeGreaterThan(0);
  expect(newState[CHART_KEY].chartStatus).toEqual('stopped');
});

test('chartReducer updates endtime and status when chart update fails with timeout', () => {
  const charts = createChartState();

  const newState = chartReducer(
    charts,
    actions.chartUpdateFailed(
      [
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
        } as JsonObject,
      ],
      CHART_KEY,
    ),
  );

  expect(newState[CHART_KEY].chartUpdateEndTime).toBeGreaterThan(0);
  expect(newState[CHART_KEY].chartStatus).toEqual('failed');
});

test('chartReducer updates form_data from latestQueryFormData on chart update success', () => {
  const latestQueryFormData = {
    datasource: '1__table',
    viz_type: 'big_number_total',
    slice_id: CHART_KEY,
    metric: { aggregate: 'COUNT_DISTINCT' },
  };

  const queriesResponse = [
    {
      data: [{ 'COUNT_DISTINCT(column)': 42 }],
      colnames: ['COUNT_DISTINCT(column)'],
      coltypes: [0],
    },
  ];

  const charts = createChartState({
    latestQueryFormData,
    form_data: { datasource: '1__table', viz_type: 'big_number_total' },
  });

  const newState = chartReducer(
    charts,
    actions.chartUpdateSucceeded(queriesResponse, CHART_KEY),
  );

  expect(newState[CHART_KEY].chartStatus).toEqual('success');
  expect(newState[CHART_KEY].queriesResponse).toEqual(queriesResponse);
  expect(newState[CHART_KEY].form_data).toEqual(latestQueryFormData);
  expect(newState[CHART_KEY].chartUpdateEndTime).toBeGreaterThan(0);
});

test('chartReducer syncs form_data with latestQueryFormData after refresh', () => {
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

  const charts = createChartState({
    latestQueryFormData: newFormData,
    form_data: oldFormData,
  });

  const newState = chartReducer(
    charts,
    actions.chartUpdateSucceeded([], CHART_KEY),
  );

  expect(newState[CHART_KEY].form_data).toEqual(newFormData);
  expect(newState[CHART_KEY].form_data.metric.aggregate).toBe('MAX');
});

test('UPDATE_CHART_FORM_DATA updates both form_data and latestQueryFormData for cross-tab sync', () => {
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

  const charts = createChartState({
    form_data: oldFormData,
    latestQueryFormData: oldFormData,
  });

  const newState = chartReducer(charts, {
    type: actions.UPDATE_CHART_FORM_DATA,
    chartId: CHART_KEY,
    formData: updatedFormData,
  });

  expect(newState[CHART_KEY].form_data).toEqual(updatedFormData);
  expect(newState[CHART_KEY].latestQueryFormData).toEqual(updatedFormData);
  expect(newState[CHART_KEY].form_data.metric.aggregate).toBe('MAX');
});
