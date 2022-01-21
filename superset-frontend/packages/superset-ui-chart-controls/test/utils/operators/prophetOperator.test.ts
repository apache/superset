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
import { DTTM_ALIAS, QueryObject, SqlaFormData } from '@superset-ui/core';
import { prophetOperator } from '../../../src';

const formData: SqlaFormData = {
  metrics: [
    'count(*)',
    { label: 'sum(val)', expressionType: 'SQL', sqlExpression: 'sum(val)' },
  ],
  time_range: '2015 : 2016',
  time_grain_sqla: 'P1Y',
  datasource: 'foo',
  viz_type: 'table',
};
const queryObject: QueryObject = {
  metrics: [
    'count(*)',
    { label: 'sum(val)', expressionType: 'SQL', sqlExpression: 'sum(val)' },
  ],
  time_range: '2015 : 2016',
  granularity: 'P1Y',
};

test('should skip prophetOperator', () => {
  expect(prophetOperator(formData, queryObject)).toEqual(undefined);
});

test('should do prophetOperator with default index', () => {
  expect(
    prophetOperator(
      {
        ...formData,
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
