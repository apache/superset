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
import { supersetTheme } from '@apache-superset/core/ui';
import {
  EchartsWaterfallChartProps,
  WaterfallChartTransformedProps,
} from '../../src/Waterfall/types';
import transformProps from '../../src/Waterfall/transformProps';

const extractSeries = (props: WaterfallChartTransformedProps) => {
  const { echartOptions } = props;
  const { series } = echartOptions as unknown as {
    series: [{ data: [{ value: number }] }];
  };
  return series.map(item => item.data).map(item => item.map(i => i.value));
};

const extractSeriesName = (props: WaterfallChartTransformedProps) => {
  const { echartOptions } = props;
  const { series } = echartOptions as unknown as {
    series: [{ name: string }];
  };
  return series.map(item => item.name);
};

const data = [
  { year: '2019', name: 'Sylvester', sum: 10 },
  { year: '2019', name: 'Arnold', sum: 3 },
  { year: '2020', name: 'Sylvester', sum: -10 },
  { year: '2020', name: 'Arnold', sum: 5 },
];

const formData = {
  colorScheme: 'bnbColors',
  datasource: '3__table',
  x_axis: 'year',
  metric: 'sum',
  increaseColor: { r: 0, b: 0, g: 0 },
  decreaseColor: { r: 0, b: 0, g: 0 },
  totalColor: { r: 0, b: 0, g: 0 },
  showTotal: true,
};

test('should tranform chart props for viz when breakdown not exist', () => {
  const chartProps = new ChartProps({
    formData: { ...formData, series: 'bar' },
    width: 800,
    height: 600,
    queriesData: [
      {
        data,
      },
    ],
    theme: supersetTheme,
  });
  const transformedProps = transformProps(
    chartProps as unknown as EchartsWaterfallChartProps,
  );
  expect(extractSeries(transformedProps)).toEqual([
    [0, 8, '-'],
    [13, '-', '-'],
    ['-', 5, '-'],
    ['-', '-', 8],
  ]);
});

test('should tranform chart props for viz when breakdown exist', () => {
  const chartProps = new ChartProps({
    formData: { ...formData, groupby: 'name' },
    width: 800,
    height: 600,
    queriesData: [
      {
        data,
      },
    ],
    theme: supersetTheme,
  });
  const transformedProps = transformProps(
    chartProps as unknown as EchartsWaterfallChartProps,
  );
  expect(extractSeries(transformedProps)).toEqual([
    [0, 10, '-', 3, 3, '-'],
    [10, 3, '-', '-', 5, '-'],
    ['-', '-', '-', 10, '-', '-'],
    ['-', '-', 13, '-', '-', 8],
  ]);
});

test('renaming series names, checking legend and X axis labels', () => {
  const chartProps = new ChartProps({
    formData: {
      ...formData,
      increaseLabel: 'sale increase',
      decreaseLabel: 'sale decrease',
      totalLabel: 'sale total',
    },
    width: 800,
    height: 600,
    queriesData: [
      {
        data,
      },
    ],
    theme: supersetTheme,
  });
  const transformedProps = transformProps(
    chartProps as unknown as EchartsWaterfallChartProps,
  );
  expect((transformedProps.echartOptions.legend as any).data).toEqual([
    'sale increase',
    'sale decrease',
    'sale total',
  ]);

  expect((transformedProps.echartOptions.xAxis as any).data).toEqual([
    '2019',
    '2020',
    'sale total',
  ]);

  expect(extractSeriesName(transformedProps)).toEqual([
    'Assist',
    'sale increase',
    'sale decrease',
    'sale total',
  ]);
});

test('hide totals', () => {
  const chartProps = new ChartProps({
    formData: { ...formData, series: 'bar', showTotal: false },
    width: 800,
    height: 600,
    queriesData: [
      {
        data,
      },
    ],
    theme: supersetTheme,
  });
  const transformedProps = transformProps(
    chartProps as unknown as EchartsWaterfallChartProps,
  );
  expect(extractSeries(transformedProps)).toEqual([
    [0, 8],
    [13, '-'],
    ['-', 5],
    ['-', '-'],
  ]);
});
