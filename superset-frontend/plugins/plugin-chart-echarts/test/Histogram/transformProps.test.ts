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
import { supersetTheme } from '@apache-superset/core/theme';
import { BarSeriesOption } from 'echarts/charts';
import transformProps from '../../src/Histogram/transformProps';
import {
  HistogramChartProps,
  HistogramFormData,
} from '../../src/Histogram/types';

const formData: HistogramFormData = {
  datasource: '5__table',
  granularity_sqla: 'ds',
  viz_type: 'histogram',
  column: 'price',
  groupby: [],
  bins: 2,
  cumulative: false,
  normalize: false,
  sliceId: 1,
  showLegend: true,
  showValue: false,
  xAxisFormat: '',
  xAxisTitle: '',
  yAxisFormat: '',
  yAxisTitle: '',
};

const createChartProps = (
  data: Record<string, unknown>[],
  overrides: Partial<HistogramFormData> = {},
) =>
  new ChartProps({
    formData: { ...formData, ...overrides },
    width: 800,
    height: 600,
    queriesData: [{ data }],
    theme: supersetTheme,
  });

test('transforms bin columns into an axis category and a bar series', () => {
  const props = createChartProps([{ '0 - 5': 3, '5 - 10': 7 }]);
  const transformed = transformProps(props as HistogramChartProps);
  const { xAxis, series } = transformed.echartOptions as {
    xAxis: { data: string[] };
    series: BarSeriesOption[];
  };

  expect(xAxis.data).toHaveLength(2);
  expect(series).toHaveLength(1);
  expect(series[0].data).toEqual([3, 7]);
});

test('renders an empty chart when the query returns no rows', () => {
  /**
   * The histogram post-processor returns an empty frame when every value in
   * the target column is NULL (`df.dropna(...)` leaves nothing), so
   * `queriesData[0].data` arrives as `[]`. Reading the bin labels off
   * `data[0]` then throws "Cannot convert undefined or null to object" and
   * the chart crashes instead of rendering as empty. Guard the lookup with
   * `data[0] ?? {}`.
   */
  const props = createChartProps([]);
  const transformed = transformProps(props as HistogramChartProps);
  const { xAxis, series } = transformed.echartOptions as {
    xAxis: { data: string[] };
    series: BarSeriesOption[];
  };

  expect(xAxis.data).toEqual([]);
  expect(series).toEqual([]);
});
