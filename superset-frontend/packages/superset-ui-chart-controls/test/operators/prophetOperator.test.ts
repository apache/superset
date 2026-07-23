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
import {
  DTTM_ALIAS,
  QueryObject,
  SqlaFormData,
  VizType,
} from '@superset-ui/core';
import { prophetOperator } from '@superset-ui/chart-controls';

const formData: SqlaFormData = {
  metrics: [
    'count(*)',
    { label: 'sum(val)', expressionType: 'SQL', sqlExpression: 'sum(val)' },
  ],
  time_range: '2015 : 2016',
  time_grain_sqla: 'P1Y',
  datasource: 'foo',
  viz_type: VizType.Table,
};
const queryObject: QueryObject = {
  metrics: [
    'count(*)',
    { label: 'sum(val)', expressionType: 'SQL', sqlExpression: 'sum(val)' },
  ],
  time_range: '2015 : 2016',
  granularity: 'P1Y',
};

// A chart whose Time Grain control was cleared to "None": form_data has no
// `time_grain_sqla` key at all (SC-113749).
const formDataWithoutGrain: SqlaFormData = { ...formData };
delete formDataWithoutGrain.time_grain_sqla;

test('should skip prophetOperator', () => {
  expect(prophetOperator(formData, queryObject)).toEqual(undefined);
});

test('should do prophetOperator with default index', () => {
  expect(
    prophetOperator(
      {
        ...formData,
        granularity_sqla: 'time_column',
        forecastEnabled: true,
        forecastPeriods: '3',
        forecastInterval: '5',
        forecastSeasonalityYearly: true,
        forecastSeasonalityWeekly: false,
        forecastSeasonalityDaily: false,
      },
      queryObject,
    ),
  ).toEqual({
    operation: 'prophet',
    options: {
      time_grain: 'P1Y',
      periods: 3.0,
      confidence_interval: 5.0,
      yearly_seasonality: true,
      weekly_seasonality: false,
      daily_seasonality: false,
      index: DTTM_ALIAS,
    },
  });
});

test('should do prophetOperator over named column', () => {
  expect(
    prophetOperator(
      {
        ...formData,
        x_axis: 'ds',
        forecastEnabled: true,
        forecastPeriods: '3',
        forecastInterval: '5',
        forecastSeasonalityYearly: true,
        forecastSeasonalityWeekly: false,
        forecastSeasonalityDaily: false,
      },
      queryObject,
    ),
  ).toEqual({
    operation: 'prophet',
    options: {
      time_grain: 'P1Y',
      periods: 3.0,
      confidence_interval: 5.0,
      yearly_seasonality: true,
      weekly_seasonality: false,
      daily_seasonality: false,
      index: 'ds',
    },
  });
});

test('should do prophetOperator over adhoc column', () => {
  expect(
    prophetOperator(
      {
        ...formData,
        x_axis: {
          label: 'my_case_expr',
          expressionType: 'SQL',
          sqlExpression: 'case when a = 1 then 1 else 0 end',
        },
        forecastEnabled: true,
        forecastPeriods: '3',
        forecastInterval: '5',
        forecastSeasonalityYearly: true,
        forecastSeasonalityWeekly: false,
        forecastSeasonalityDaily: false,
      },
      queryObject,
    ),
  ).toEqual({
    operation: 'prophet',
    options: {
      time_grain: 'P1Y',
      periods: 3.0,
      confidence_interval: 5.0,
      yearly_seasonality: true,
      weekly_seasonality: false,
      daily_seasonality: false,
      index: 'my_case_expr',
    },
  });
});

test('should fall back to a daily grain when no time grain is resolvable', () => {
  // Regression for SC-113749: a saved/dashboard chart with the Time Grain
  // control cleared to "None" has no `time_grain_sqla` in form_data. Prior to
  // the fix this emitted `time_grain: undefined`, which `JSON.stringify` drops,
  // causing the backend `prophet()` call to raise a raw `TypeError`.
  expect(
    prophetOperator(
      {
        ...formDataWithoutGrain,
        granularity_sqla: 'time_column',
        forecastEnabled: true,
        forecastPeriods: '3',
        forecastInterval: '5',
        forecastSeasonalityYearly: true,
        forecastSeasonalityWeekly: false,
        forecastSeasonalityDaily: false,
      },
      { ...queryObject, extras: {} },
    ),
  ).toEqual({
    operation: 'prophet',
    options: {
      time_grain: 'P1D',
      periods: 3.0,
      confidence_interval: 5.0,
      yearly_seasonality: true,
      weekly_seasonality: false,
      daily_seasonality: false,
      index: DTTM_ALIAS,
    },
  });
});

test('should resolve the time grain from the adhoc x-axis column', () => {
  // With the generic x-axis, the grain lives on the column's popover
  // (`timeGrain`) rather than the `time_grain_sqla` panel control.
  expect(
    prophetOperator(
      {
        ...formDataWithoutGrain,
        x_axis: {
          label: 'ds',
          expressionType: 'SQL',
          sqlExpression: 'ds',
          timeGrain: 'P1M',
        },
        forecastEnabled: true,
        forecastPeriods: '3',
        forecastInterval: '5',
        forecastSeasonalityYearly: true,
        forecastSeasonalityWeekly: false,
        forecastSeasonalityDaily: false,
      },
      { ...queryObject, extras: {} },
    ),
  ).toEqual({
    operation: 'prophet',
    options: {
      time_grain: 'P1M',
      periods: 3.0,
      confidence_interval: 5.0,
      yearly_seasonality: true,
      weekly_seasonality: false,
      daily_seasonality: false,
      index: 'ds',
    },
  });
});

test('should resolve the time grain from the query object extras', () => {
  // Dashboard-applied grains (e.g. via native filters) land in
  // `queryObject.extras.time_grain_sqla` even when form_data has none.
  expect(
    prophetOperator(
      {
        ...formDataWithoutGrain,
        granularity_sqla: 'time_column',
        forecastEnabled: true,
        forecastPeriods: '3',
        forecastInterval: '5',
        forecastSeasonalityYearly: true,
        forecastSeasonalityWeekly: false,
        forecastSeasonalityDaily: false,
      },
      { ...queryObject, extras: { time_grain_sqla: 'P1W' } },
    ),
  ).toEqual({
    operation: 'prophet',
    options: {
      time_grain: 'P1W',
      periods: 3.0,
      confidence_interval: 5.0,
      yearly_seasonality: true,
      weekly_seasonality: false,
      daily_seasonality: false,
      index: DTTM_ALIAS,
    },
  });
});
