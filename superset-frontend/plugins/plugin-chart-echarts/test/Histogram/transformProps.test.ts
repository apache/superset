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
import { getHistogramCrossFilterKey } from '../../src/Histogram/crossFilter';
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
  showSelectorLegend: true,
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

const readChart = (props: ChartProps) => {
  const transformed = transformProps(props as HistogramChartProps);
  const { xAxis, series } = transformed.echartOptions as {
    xAxis: { data: string[] };
    series: BarSeriesOption[];
  };
  return { xAxis, series };
};

test('transforms bin columns into an axis category and a bar series', () => {
  const { xAxis, series } = readChart(
    createChartProps([{ '0 - 5': 3, '5 - 10': 7 }]),
  );

  expect(xAxis.data).toHaveLength(2);
  expect(series).toHaveLength(1);
  expect(series[0].data).toEqual([{ value: 3 }, { value: 7 }]);
});

test('keeps physical groupby columns off the x-axis', () => {
  const { xAxis, series } = readChart(
    createChartProps([{ region: 'WEST', '0 - 5': 3, '5 - 10': 7 }], {
      groupby: ['region'],
    }),
  );

  expect(xAxis.data).toHaveLength(2);
  expect(xAxis.data.every(label => !label.includes('NaN'))).toBe(true);
  expect(series[0].name).toBe('WEST');
  expect(series[0].data).toEqual([{ value: 3 }, { value: 7 }]);
});

test('does not treat adhoc groupby labels as histogram bin edges', () => {
  /**
   * Query results key groupby columns by getColumnLabel(), but groupby
   * membership was checked against the raw form-data entries. Adhoc columns
   * are objects, so they fail that filter, get parsed as bin edges, and
   * show up as a NaN bin label on the x-axis.
   */
  const adhocGroupby = {
    expressionType: 'SQL' as const,
    sqlExpression: 'UPPER(region)',
    label: 'region_upper',
  };
  const { xAxis, series } = readChart(
    createChartProps([{ region_upper: 'WEST', '0 - 5': 3, '5 - 10': 7 }], {
      groupby: [adhocGroupby],
    }),
  );

  expect(xAxis.data).toHaveLength(2);
  expect(xAxis.data.every(label => !label.includes('NaN'))).toBe(true);
  expect(series[0].name).toBe('WEST');
  expect(series[0].data).toEqual([{ value: 3 }, { value: 7 }]);
});

test('dims bars outside the selected bin and uses a pointer cursor', () => {
  const props = new ChartProps({
    formData,
    width: 800,
    height: 600,
    queriesData: [{ data: [{ '0 - 5': 3, '5 - 10': 7 }] }],
    theme: supersetTheme,
    filterState: {
      selectedValues: [getHistogramCrossFilterKey({ start: 0, end: 5 }, [])],
    },
    emitCrossFilters: true,
  });
  const { series } = readChart(props);
  const points = series[0].data as {
    value: number;
    itemStyle?: { opacity?: number };
  }[];

  expect(points[0].itemStyle?.opacity).toBeUndefined();
  expect(points[1].itemStyle?.opacity).toBe(0.3);
  expect(series[0].cursor).toBe('pointer');
});

test('leaves bars undimmed when the selected edges match no bar', () => {
  const props = new ChartProps({
    formData,
    width: 800,
    height: 600,
    queriesData: [{ data: [{ '0 - 5': 3, '5 - 10': 7 }] }],
    theme: supersetTheme,
    filterState: {
      selectedValues: [getHistogramCrossFilterKey({ start: 1, end: 6 }, [])],
    },
  });
  const { series } = readChart(props);
  const points = series[0].data as {
    value: number;
    itemStyle?: { opacity?: number };
  }[];

  expect(points[0].itemStyle?.opacity).toBeUndefined();
  expect(points[1].itemStyle?.opacity).toBeUndefined();
});

test("dims another group's bar for the same selected bin", () => {
  const props = new ChartProps({
    formData: { ...formData, groupby: ['region'] },
    width: 800,
    height: 600,
    queriesData: [
      {
        data: [
          { region: 'WEST', '0 - 5': 3, '5 - 10': 1 },
          { region: 'EAST', '0 - 5': 4, '5 - 10': 2 },
        ],
      },
    ],
    theme: supersetTheme,
    filterState: {
      selectedValues: [
        getHistogramCrossFilterKey({ start: 0, end: 5 }, ['WEST']),
      ],
    },
  });
  const { series } = readChart(props);
  const opacity = (seriesIndex: number, dataIndex: number) =>
    (
      series[seriesIndex].data as {
        itemStyle?: { opacity?: number };
      }[]
    )[dataIndex].itemStyle?.opacity;

  expect(series[0].name).toBe('WEST');
  expect(series[1].name).toBe('EAST');
  expect(opacity(0, 0)).toBeUndefined();
  expect(opacity(1, 0)).toBe(0.3);
});

test('renders an empty chart when the query returns no rows', () => {
  const props = new ChartProps({
    formData,
    width: 800,
    height: 600,
    queriesData: [{ data: [] }],
    theme: supersetTheme,
  });

  const { xAxis, series } = readChart(props);

  expect(xAxis.data).toEqual([]);
  expect(series).toEqual([]);
});

test('tooltip rows start with a marker in the series color', () => {
  const { tooltip } = transformProps(
    createChartProps([{ '0 - 5': 3, '5 - 10': 7 }]) as HistogramChartProps,
  ).echartOptions as { tooltip: { formatter: (params: unknown) => string } };
  const html = tooltip.formatter([
    { name: '0 - 5', seriesName: 'price', value: 3, color: '#1f77b4' },
  ]);
  expect(html.replace(/\s/g, '')).toContain('style="color:#1f77b4;');
  expect(html).toContain('price');
});
