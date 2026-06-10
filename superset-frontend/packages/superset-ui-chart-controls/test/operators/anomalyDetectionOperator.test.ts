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
import { anomalyDetectionOperator } from '@superset-ui/chart-controls';

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

test('should skip anomalyDetectionOperator when not enabled', () => {
  expect(anomalyDetectionOperator(formData, queryObject)).toEqual(undefined);
});

test('should skip anomalyDetectionOperator when enabled but no x axis', () => {
  expect(
    anomalyDetectionOperator(
      {
        ...formData,
        anomalyDetectionEnabled: true,
        anomalyDetectionMethod: 'zscore',
        anomalyDetectionRollingWindow: '14',
        anomalyDetectionSensitivity: '3.0',
      },
      queryObject,
    ),
  ).toEqual(undefined);
});

test('should do anomalyDetectionOperator with default index', () => {
  expect(
    anomalyDetectionOperator(
      {
        ...formData,
        granularity_sqla: 'time_column',
        anomalyDetectionEnabled: true,
        anomalyDetectionMethod: 'zscore',
        anomalyDetectionRollingWindow: '14',
        anomalyDetectionSensitivity: '3.0',
      },
      queryObject,
    ),
  ).toEqual({
    operation: 'anomaly_detection',
    options: {
      method: 'zscore',
      rolling_window: 14,
      sensitivity: 3.0,
      index: DTTM_ALIAS,
    },
  });
});

test('should do anomalyDetectionOperator with mad method', () => {
  expect(
    anomalyDetectionOperator(
      {
        ...formData,
        granularity_sqla: 'time_column',
        anomalyDetectionEnabled: true,
        anomalyDetectionMethod: 'mad',
        anomalyDetectionRollingWindow: '7',
        anomalyDetectionSensitivity: '2.5',
      },
      queryObject,
    ),
  ).toEqual({
    operation: 'anomaly_detection',
    options: {
      method: 'mad',
      rolling_window: 7,
      sensitivity: 2.5,
      index: DTTM_ALIAS,
    },
  });
});

test('should do anomalyDetectionOperator over named column', () => {
  expect(
    anomalyDetectionOperator(
      {
        ...formData,
        x_axis: 'ds',
        anomalyDetectionEnabled: true,
        anomalyDetectionMethod: 'zscore',
        anomalyDetectionRollingWindow: '14',
        anomalyDetectionSensitivity: '3.0',
      },
      queryObject,
    ),
  ).toEqual({
    operation: 'anomaly_detection',
    options: {
      method: 'zscore',
      rolling_window: 14,
      sensitivity: 3.0,
      index: 'ds',
    },
  });
});

test('should do anomalyDetectionOperator over adhoc column', () => {
  expect(
    anomalyDetectionOperator(
      {
        ...formData,
        x_axis: {
          label: 'my_case_expr',
          expressionType: 'SQL',
          sqlExpression: 'case when a = 1 then 1 else 0 end',
        },
        anomalyDetectionEnabled: true,
        anomalyDetectionMethod: 'zscore',
        anomalyDetectionRollingWindow: '14',
        anomalyDetectionSensitivity: '3.0',
      },
      queryObject,
    ),
  ).toEqual({
    operation: 'anomaly_detection',
    options: {
      method: 'zscore',
      rolling_window: 14,
      sensitivity: 3.0,
      index: 'my_case_expr',
    },
  });
});

test('should do anomalyDetectionOperator with prophet method', () => {
  expect(
    anomalyDetectionOperator(
      {
        ...formData,
        granularity_sqla: 'time_column',
        anomalyDetectionEnabled: true,
        anomalyDetectionMethod: 'prophet',
        anomalyDetectionConfidenceInterval: '0.8',
        anomalyDetectionSeasonalityYearly: true,
        anomalyDetectionSeasonalityWeekly: false,
        anomalyDetectionSeasonalityDaily: null,
      },
      queryObject,
    ),
  ).toEqual({
    operation: 'anomaly_detection',
    options: {
      method: 'prophet',
      index: DTTM_ALIAS,
      confidence_interval: 0.8,
      yearly_seasonality: true,
      weekly_seasonality: false,
      daily_seasonality: null,
    },
  });
});
