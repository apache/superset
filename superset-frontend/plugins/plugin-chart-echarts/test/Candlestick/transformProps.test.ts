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
import { GenericDataType } from '@apache-superset/core/common';
import { supersetTheme } from '@apache-superset/core/theme';
import {
  CandlestickChartTransformedProps,
  EchartsCandlestickChartProps,
} from '../../src/Candlestick/types';
import transformProps from '../../src/Candlestick/transformProps';
import { CANDLESTICK_SERIES_NAME } from '../../src/Candlestick/constants';

const data = [
  { date: '2017-10-24', open: 20, close: 34, low: 10, high: 38 },
  { date: '2017-10-25', open: 40, close: 35, low: 30, high: 50 },
  { date: '2017-10-26', open: 31, close: 38, low: 33, high: 44 },
  { date: '2017-10-27', open: 38, close: 15, low: 5, high: 42 },
];

const formData = {
  colorScheme: 'bnbColors',
  datasource: '3__table',
  x_axis: 'date',
  open: 'open',
  close: 'close',
  high: 'high',
  low: 'low',
  increase_color: { r: 90, g: 193, b: 137, a: 1 },
  decrease_color: { r: 224, g: 67, b: 85, a: 1 },
  moving_averages: [],
};

const buildProps = (extraFormData: Record<string, unknown> = {}) =>
  transformProps(
    new ChartProps({
      formData: { ...formData, ...extraFormData },
      width: 800,
      height: 600,
      queriesData: [{ data }],
      theme: supersetTheme,
    }) as unknown as EchartsCandlestickChartProps,
  );

const extractSeries = (props: CandlestickChartTransformedProps) => {
  const { series } = props.echartOptions as {
    series: { name: string; data: unknown[] }[];
  };
  return series;
};

test('maps rows to ECharts candlestick [open, close, low, high] values', () => {
  const series = extractSeries(buildProps());
  expect(series).toHaveLength(1);
  expect(series[0].name).toBe(CANDLESTICK_SERIES_NAME);
  expect(series[0].data).toEqual([
    [20, 34, 10, 38],
    [40, 35, 30, 50],
    [31, 38, 33, 44],
    [38, 15, 5, 42],
  ]);
});

test('uses x-axis values as category labels', () => {
  const { echartOptions } = buildProps();
  expect((echartOptions.xAxis as { data: string[] }).data).toEqual([
    '2017-10-24',
    '2017-10-25',
    '2017-10-26',
    '2017-10-27',
  ]);
});

test('applies increase and decrease colors', () => {
  const series = extractSeries(buildProps());
  expect(series[0]).toEqual(
    expect.objectContaining({
      itemStyle: {
        color: '#5ac189',
        color0: '#e04355',
        borderColor: '#5ac189',
        borderColor0: '#e04355',
      },
    }),
  );
});

test('hides axes when showXAxis or showYAxis is false', () => {
  const { echartOptions } = buildProps({
    show_x_axis: false,
    show_y_axis: false,
  });
  expect((echartOptions.xAxis as { show: boolean }).show).toBe(false);
  expect((echartOptions.yAxis as { show: boolean }).show).toBe(false);
});

test('splits data into multiple series when a series dimension is set', () => {
  const seriesData = [
    {
      date: '2017-10-24',
      symbol: 'AAPL',
      open: 20,
      close: 34,
      low: 10,
      high: 38,
    },
    {
      date: '2017-10-24',
      symbol: 'GOOG',
      open: 40,
      close: 35,
      low: 30,
      high: 50,
    },
    {
      date: '2017-10-25',
      symbol: 'AAPL',
      open: 31,
      close: 38,
      low: 33,
      high: 44,
    },
    {
      date: '2017-10-25',
      symbol: 'GOOG',
      open: 38,
      close: 15,
      low: 5,
      high: 42,
    },
  ];
  const props = transformProps(
    new ChartProps({
      formData: { ...formData, series: 'symbol' },
      width: 800,
      height: 600,
      queriesData: [{ data: seriesData }],
      theme: supersetTheme,
    }) as unknown as EchartsCandlestickChartProps,
  );
  const series = extractSeries(props);
  expect(series.map(item => item.name)).toEqual(['AAPL', 'GOOG']);
  expect(series[0].data).toEqual([
    [20, 34, 10, 38],
    [31, 38, 33, 44],
  ]);
  expect(series[1].data).toEqual([
    [40, 35, 30, 50],
    [38, 15, 5, 42],
  ]);
});

test('uses empty arrays for missing candles so category indexes stay aligned', () => {
  const seriesData = [
    {
      date: '2017-10-24',
      symbol: 'AAPL',
      open: 20,
      close: 34,
      low: 10,
      high: 38,
    },
    {
      date: '2017-10-25',
      symbol: 'GOOG',
      open: 40,
      close: 35,
      low: 30,
      high: 50,
    },
  ];
  const props = transformProps(
    new ChartProps({
      formData: { ...formData, series: 'symbol' },
      width: 800,
      height: 600,
      queriesData: [{ data: seriesData }],
      theme: supersetTheme,
    }) as unknown as EchartsCandlestickChartProps,
  );
  const series = extractSeries(props);
  expect(series[0].data).toEqual([[20, 34, 10, 38], []]);
  expect(series[1].data).toEqual([[], [40, 35, 30, 50]]);
});

test('overlays MA lines of the close price', () => {
  const series = extractSeries(
    buildProps({
      moving_averages: [2, 3],
    }),
  );
  expect(series.map(item => item.name)).toEqual([
    CANDLESTICK_SERIES_NAME,
    'MA2',
    'MA3',
  ]);
  // calculateMA matches the ECharts example: first `period` points are '-'.
  expect(series[1].data).toEqual(['-', '-', 36.5, 26.5]);
  expect(series[2].data).toEqual(['-', '-', '-', 29.333333333333332]);
  expect(series[1]).toEqual(
    expect.objectContaining({
      type: 'line',
      smooth: true,
      showSymbol: false,
      lineStyle: { opacity: 0.5 },
    }),
  );
});

test('qualifies MA names when multiple candlestick series are present', () => {
  const seriesData = [
    {
      date: '2017-10-24',
      symbol: 'AAPL',
      open: 20,
      close: 34,
      low: 10,
      high: 38,
    },
    {
      date: '2017-10-25',
      symbol: 'AAPL',
      open: 31,
      close: 38,
      low: 33,
      high: 44,
    },
    {
      date: '2017-10-24',
      symbol: 'GOOG',
      open: 40,
      close: 35,
      low: 30,
      high: 50,
    },
    {
      date: '2017-10-25',
      symbol: 'GOOG',
      open: 38,
      close: 15,
      low: 5,
      high: 42,
    },
  ];
  const props = transformProps(
    new ChartProps({
      formData: { ...formData, series: 'symbol', moving_averages: [2] },
      width: 800,
      height: 600,
      queriesData: [{ data: seriesData }],
      theme: supersetTheme,
    }) as unknown as EchartsCandlestickChartProps,
  );
  expect(extractSeries(props).map(item => item.name)).toEqual([
    'AAPL',
    'GOOG',
    'AAPL MA2',
    'GOOG MA2',
  ]);
});

test('keeps series and x-axis values distinct when they contain the same characters', () => {
  const seriesData = [
    {
      date: 'bar::baz',
      symbol: 'foo',
      open: 20,
      close: 34,
      low: 10,
      high: 38,
    },
    {
      date: 'baz',
      symbol: 'foo::bar',
      open: 40,
      close: 35,
      low: 30,
      high: 50,
    },
  ];
  const props = transformProps(
    new ChartProps({
      formData: { ...formData, series: 'symbol' },
      width: 800,
      height: 600,
      queriesData: [{ data: seriesData }],
      theme: supersetTheme,
    }) as unknown as EchartsCandlestickChartProps,
  );
  const series = extractSeries(props);
  expect(series.map(item => item.name)).toEqual(['foo', 'foo::bar']);
  expect(series[0].data).toEqual([[20, 34, 10, 38], []]);
  expect(series[1].data).toEqual([[], [40, 35, 30, 50]]);
});

test('formats tooltip dates from the category, not the raw row index', () => {
  const seriesData = [
    {
      date: '2017-10-24',
      symbol: 'AAPL',
      open: 20,
      close: 34,
      low: 10,
      high: 38,
    },
    {
      date: '2017-10-24',
      symbol: 'GOOG',
      open: 40,
      close: 35,
      low: 30,
      high: 50,
    },
    {
      date: '2017-10-25',
      symbol: 'AAPL',
      open: 31,
      close: 38,
      low: 33,
      high: 44,
    },
    {
      date: '2017-10-25',
      symbol: 'GOOG',
      open: 38,
      close: 15,
      low: 5,
      high: 42,
    },
  ];
  const props = transformProps(
    new ChartProps({
      formData: {
        ...formData,
        series: 'symbol',
        tooltip_time_format: '%Y-%m-%d',
      },
      width: 800,
      height: 600,
      queriesData: [
        {
          data: seriesData,
          colnames: ['date', 'symbol', 'open', 'close', 'high', 'low'],
          coltypes: [
            GenericDataType.Temporal,
            GenericDataType.String,
            GenericDataType.Numeric,
            GenericDataType.Numeric,
            GenericDataType.Numeric,
            GenericDataType.Numeric,
          ],
        },
      ],
      theme: supersetTheme,
    }) as unknown as EchartsCandlestickChartProps,
  );
  const tooltipFormatter = (
    props.echartOptions.tooltip as {
      formatter: (params: unknown) => string;
    }
  ).formatter;
  const tooltipHtml = tooltipFormatter([
    {
      dataIndex: 1,
      name: '2017-10-25',
      seriesType: 'candlestick',
      value: [31, 38, 33, 44],
      data: [31, 38, 33, 44],
    },
  ]);
  expect(tooltipHtml).toContain('2017-10-25');
  expect(tooltipHtml).not.toContain('2017-10-24');
});
