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
import { QueryFormData, TimeGranularity } from '@superset-ui/core';
import { getDrillPayload } from './utils';

test('Sunburst samples carry chart type with an independent temporal drill', () => {
  const drill = {
    col: 'order_date',
    op: '==' as const,
    val: 1785542400000,
    grain: TimeGranularity.MONTH,
  };
  const payload = getDrillPayload(
    {
      datasource: '1__table',
      viz_type: 'sunburst_v2',
      granularity_sqla: 'ship_date',
      time_grain_sqla: 'P1M',
      time_range: '2026-07-01 : 2026-10-01',
    } as QueryFormData,
    [drill],
  );
  expect(payload).toEqual({
    viz_type: 'sunburst_v2',
    granularity: 'ship_date',
    time_range: '2026-07-01 : 2026-10-01',
    filters: [drill],
    extras: { time_grain_sqla: 'P1M', where: '' },
    url_params: {},
  });
});

test('carries the chart url_params so url_param() renders like the chart', () => {
  const payload = getDrillPayload({
    datasource: '1__table',
    viz_type: 'table',
    url_params: { tenant: 'zenda' },
  } as QueryFormData);
  expect(payload?.url_params).toEqual({ tenant: 'zenda' });
});

test('carries the chart x-axis so the time range lands on it like the chart', () => {
  const xAxis = { label: 'day', sqlExpression: 'DATE(created_at)' };
  const payload = getDrillPayload({
    datasource: '1__table',
    viz_type: 'echarts_timeseries_bar',
    x_axis: xAxis,
  } as QueryFormData);
  expect(payload?.x_axis).toEqual(xAxis);
});

test('omits the x-axis for charts without one', () => {
  const payload = getDrillPayload({
    datasource: '1__table',
    viz_type: 'table',
  } as QueryFormData);
  expect(payload).not.toHaveProperty('x_axis');
});
