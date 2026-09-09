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
import { EchartsSunburstChartProps } from '../../src/Sunburst/types';
import transformProps from '../../src/Sunburst/transformProps';

type SunburstSeries = {
  label?: Record<string, unknown>;
  data: { value: number }[];
};
const firstSeries = (echartOptions: unknown) =>
  (echartOptions as { series: SunburstSeries[] }).series[0];

const formData = {
  colorScheme: 'bnbColors',
  datasource: '3__table',
  groupby: ['category'],
  metric: 'sum__value',
};

const chartProps = new ChartProps({
  formData,
  width: 800,
  height: 600,
  queriesData: [
    {
      data: [
        { category: 'A', sum__value: 10 },
        { category: 'B', sum__value: 20 },
      ],
    },
  ],
  theme: supersetTheme,
});

test('series label has no textBorderColor or textBorderWidth', () => {
  const { echartOptions } = transformProps(
    chartProps as EchartsSunburstChartProps,
  );
  const series = firstSeries(echartOptions);
  expect(series.label).not.toHaveProperty('textBorderColor');
  expect(series.label).not.toHaveProperty('textBorderWidth');
});

const nullValueProps = (showNullValues?: boolean) =>
  new ChartProps({
    formData: {
      colorScheme: 'bnbColors',
      datasource: '3__table',
      columns: ['category'],
      metric: 'sum__value',
      ...(showNullValues === undefined ? {} : { showNullValues }),
    },
    width: 800,
    height: 600,
    queriesData: [
      {
        data: [
          { category: 'A', sum__value: 10 },
          { category: 'B', sum__value: 20 },
          { category: null, sum__value: 5 },
        ],
      },
    ],
    theme: supersetTheme,
  });

const seriesValues = (props: ChartProps) => {
  const { echartOptions } = transformProps(props as EchartsSunburstChartProps);
  return firstSeries(echartOptions)
    .data.map(node => node.value)
    .sort((a, b) => a - b);
};

// Charts saved before the "Show Null Values" control existed have no
// `showNullValues` in form data; they must keep showing nulls (non-breaking).
test('keeps null values when showNullValues is unset (legacy charts)', () => {
  expect(seriesValues(nullValueProps(undefined))).toEqual([5, 10, 20]);
});

test('keeps null values when showNullValues is true', () => {
  expect(seriesValues(nullValueProps(true))).toEqual([5, 10, 20]);
});

// Single-column sunburst: the toggle must actually drop the null node.
test('removes null values when showNullValues is false', () => {
  expect(seriesValues(nullValueProps(false))).toEqual([10, 20]);
});
