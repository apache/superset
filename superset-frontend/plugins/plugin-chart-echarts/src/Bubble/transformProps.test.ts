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
import { SqlaFormData } from '@superset-ui/core';
import transformProps from './transformProps';
import { EchartsBubbleChartProps } from './types';

const baseFormData: SqlaFormData = {
  datasource: '1__table',
  viz_type: 'bubble_v2',
  entity: 'customer_name',
  x: 'price',
  y: 'sales',
  size: 'count',
};

const baseChartProps = {
  width: 400,
  height: 400,
  hooks: {},
  queriesData: [
    {
      data: [
        { customer_name: 'A', price: 10, sales: 100, count: 5 },
        { customer_name: 'B', price: 20, sales: 200, count: 8 },
      ],
    },
  ],
  theme: { colorText: '#000' },
};

test('nests xAxisLabelInterval under axisLabel rather than the axis itself', () => {
  // Regression test: xAxis.interval forces echarts' IntervalScale into a
  // fixed-tick-spacing mode that expects a number and crashes on the
  // 'auto'/'0' strings this control actually produces (observed as an
  // uncaught assertion deep in echarts' axis "nice" tick calculation,
  // reproducing on every dashboard bubble chart). The interval belongs on
  // axisLabel, where it only controls how many labels are skipped.
  const { echartOptions } = transformProps({
    ...baseChartProps,
    formData: baseFormData,
  } as unknown as EchartsBubbleChartProps);

  expect((echartOptions.xAxis as any).interval).toBeUndefined();
  expect((echartOptions.xAxis as any).axisLabel.interval).toBe('auto');
});

test('honors an explicit xAxisLabelInterval override', () => {
  const { echartOptions } = transformProps({
    ...baseChartProps,
    formData: { ...baseFormData, xAxisLabelInterval: '0' },
  } as unknown as EchartsBubbleChartProps);

  expect((echartOptions.xAxis as any).axisLabel.interval).toBe('0');
});
