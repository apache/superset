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
import { ChartProps } from '@superset-ui/core';
import transformProps from '../../../src/BigNumber/BigNumberPeriodOverPeriod/transformProps';

const buildChartProps = (formData: Record<string, unknown>) =>
  new ChartProps({
    width: 400,
    height: 300,
    formData: {
      datasource: '1__table',
      viz_type: 'pop_kpi',
      metric: 'count',
      ...formData,
    },
    queriesData: [{ data: [{ count: 10, 'count__1 year ago': 5 }] }],
    datasource: { metrics: [] },
  } as unknown as ConstructorParameters<typeof ChartProps>[0]);

test('passes increase_color and decrease_color form data through to the chart', () => {
  const result = transformProps(
    buildChartProps({
      increase_color: '#112233',
      decrease_color: '#445566',
    }),
  );

  expect(result.increaseColor).toBe('#112233');
  expect(result.decreaseColor).toBe('#445566');
});

test('leaves increaseColor and decreaseColor undefined when unset', () => {
  const result = transformProps(buildChartProps({}));

  expect(result.increaseColor).toBeUndefined();
  expect(result.decreaseColor).toBeUndefined();
});
