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
import { applyStructuredSeries } from './structuredSeries';

test('without a chart type the option is left as authored', () => {
  const option = { series: [{ type: 'pie' }] };

  expect(applyStructuredSeries(option, { chartType: null })).toBe(option);
});

test('a chart type draws one series per metric over the first dimension', () => {
  const option = applyStructuredSeries(
    { xAxis: { type: 'category' }, yAxis: { name: 'Births' } },
    {
      chartType: 'line',
      dataBinding: {
        metrics: ['sum__num', { label: 'Girls' }],
        dimensions: ['ds'],
      },
      customize: { series: { Girls: { color: '#f00', displayName: 'F' } } },
    },
  );

  expect(option.xAxis).toEqual({
    type: 'category',
    data: { $bind: { source: 'dimension', alias: 'ds' } },
  });
  expect(option.yAxis).toEqual({ name: 'Births' });
  expect(option.series).toEqual([
    {
      type: 'line',
      name: 'sum__num',
      data: { $bind: { source: 'metric', alias: 'sum__num' } },
    },
    {
      type: 'line',
      name: 'F',
      data: { $bind: { source: 'metric', alias: 'Girls' } },
      itemStyle: { color: '#f00' },
    },
  ]);
});

test('a hidden series is left out', () => {
  const option = applyStructuredSeries(
    {},
    {
      chartType: 'bar',
      dataBinding: { metrics: ['a', 'b'], dimensions: ['d'] },
      customize: { series: { b: { visible: false } } },
    },
  );

  expect(option.series).toHaveLength(1);
  expect(option.yAxis).toEqual({ type: 'value' });
});
