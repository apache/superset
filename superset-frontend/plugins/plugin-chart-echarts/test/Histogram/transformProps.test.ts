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
import { ChartProps, DataRecord } from '@superset-ui/core';
import { supersetTheme } from '@apache-superset/core/theme';
import type { BarSeriesOption } from 'echarts/charts';
import type { TooltipComponentOption } from 'echarts/components';
import transformProps from '../../src/Histogram/transformProps';
import {
  HistogramChartProps,
  HistogramFormData,
} from '../../src/Histogram/types';
import { NULL_STRING } from '../../src/constants';

const createChartProps = (data: DataRecord[], groupby = ['category']) =>
  new ChartProps<HistogramFormData>({
    formData: {
      datasource: '1__table',
      viz_type: 'histogram_v2',
      column: 'value',
      groupby,
      bins: 1,
      cumulative: false,
      normalize: false,
      sliceId: 1,
      showLegend: true,
      showValue: false,
      xAxisFormat: ',d',
      xAxisTitle: '',
      yAxisFormat: ',d',
      yAxisTitle: '',
    },
    queriesData: [{ data }],
    width: 800,
    height: 600,
    theme: supersetTheme,
  }) as HistogramChartProps;

test('keeps null groups distinct from empty strings and other falsy labels', () => {
  const { echartOptions } = transformProps(
    createChartProps([
      { category: null, '0 - 10': 2 },
      { category: '', '0 - 10': 3 },
      { category: 0, '0 - 10': 4 },
      { category: false, '0 - 10': 5 },
      { category: 'Other', '0 - 10': 6 },
    ]),
  );

  expect(echartOptions.series).toEqual([
    expect.objectContaining({ name: NULL_STRING, data: [2] }),
    expect.objectContaining({ name: '', data: [3] }),
    expect.objectContaining({ name: '0', data: [4] }),
    expect.objectContaining({ name: 'false', data: [5] }),
    expect.objectContaining({ name: 'Other', data: [6] }),
  ]);
  expect(echartOptions.legend).toEqual(
    expect.objectContaining({
      data: [NULL_STRING, '', '0', 'false', 'Other'],
      selected: {
        [NULL_STRING]: true,
        '': true,
        '0': true,
        false: true,
        Other: true,
      },
    }),
  );
});

test.each([
  [null, 'West', `${NULL_STRING}, West`],
  ['West', null, `West, ${NULL_STRING}`],
  [null, null, `${NULL_STRING}, ${NULL_STRING}`],
  ['', false, ', false'],
])('formats the group values %p and %p as %s', (category, region, name) => {
  const { echartOptions } = transformProps(
    createChartProps(
      [{ category, region, '0 - 10': 2 }],
      ['category', 'region'],
    ),
  );

  expect(echartOptions.series).toEqual([
    expect.objectContaining({ name, data: [2] }),
  ]);
  expect(echartOptions.legend).toEqual(
    expect.objectContaining({ data: [name] }),
  );
});

test('shows the null group label as text in the tooltip', () => {
  const { echartOptions } = transformProps(
    createChartProps([{ category: null, '0 - 10': 2 }]),
  );
  const [series] = echartOptions.series as BarSeriesOption[];
  const { formatter } = echartOptions.tooltip as TooltipComponentOption;
  if (typeof formatter !== 'function') {
    throw new Error('Expected a tooltip formatter');
  }
  const html = formatter(
    [
      {
        componentType: 'series',
        componentSubType: 'bar',
        componentIndex: 0,
        seriesType: 'bar',
        seriesIndex: 0,
        seriesName: String(series.name),
        name: '0 - 10',
        dataIndex: 0,
        data: 2,
        value: 2,
        marker: '<span class="marker"></span>',
        $vars: ['seriesName', 'name', 'value'],
      },
    ],
    '',
    jest.fn(),
  );
  const tooltip = document.createElement('div');
  tooltip.innerHTML = String(html);

  expect(tooltip.querySelector('td')?.textContent).toBe(NULL_STRING);
  expect(tooltip.querySelector('.marker')).not.toBeNull();
});

test('uses the value column name without group by columns', () => {
  const { echartOptions } = transformProps(
    createChartProps([{ '0 - 10': 2 }], []),
  );

  expect(echartOptions.series).toEqual([
    expect.objectContaining({ name: 'value', data: [2] }),
  ]);
});
