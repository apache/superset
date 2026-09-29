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
import { CategoricalColorNamespace, ChartProps } from '@superset-ui/core';
import { GenericDataType } from '@apache-superset/core/common';
import { supersetTheme } from '@apache-superset/core/theme';
import {
  CandlestickChartTransformedProps,
  EchartsCandlestickChartProps,
} from '../../src/Candlestick/types';
import transformProps from '../../src/Candlestick/transformProps';
import { CANDLESTICK_SERIES_NAME } from '../../src/Candlestick/constants';
import { NULL_STRING } from '../../src/constants';

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
    series: {
      name: string;
      type?: string;
      data: unknown[];
      renderItem?: (...args: unknown[]) => unknown;
    }[];
  };
  return series;
};

const transform = (
  rows: Record<string, unknown>[],
  extraFormData: Record<string, unknown> = {},
) =>
  transformProps(
    new ChartProps({
      formData: { ...formData, ...extraFormData },
      width: 800,
      height: 600,
      queriesData: [{ data: rows }],
      theme: supersetTheme,
    }) as unknown as EchartsCandlestickChartProps,
  );

const getTooltipHtml = (
  props: CandlestickChartTransformedProps,
  params: unknown,
) =>
  (
    props.echartOptions.tooltip as {
      formatter: (value: unknown) => string;
    }
  ).formatter(params);

test('uses a custom series name when no series dimension is set', () => {
  const series = extractSeries(buildProps({ candlestick_series_name: 'OHLC' }));
  expect(series[0].name).toBe('OHLC');
});

test('falls back to the default series name when the custom name is blank', () => {
  const series = extractSeries(buildProps({ candlestick_series_name: '   ' }));
  expect(series[0].name).toBe(CANDLESTICK_SERIES_NAME);
});

test('ignores the custom series name when a series dimension is set', () => {
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
  ];
  const series = extractSeries(
    transform(seriesData, {
      series: 'symbol',
      candlestick_series_name: 'OHLC',
    }),
  );
  expect(series.map(item => item.name)).toEqual(['AAPL', 'GOOG']);
  expect(series.map(item => item.name)).not.toContain('OHLC');
});

test('maps rows to ECharts candlestick [open, close, low, high] values', () => {
  const series = extractSeries(buildProps());
  expect(series).toHaveLength(1);
  expect(series[0].name).toBe(CANDLESTICK_SERIES_NAME);
  expect(series[0].type).toBe('candlestick');
  expect(series[0].data).toEqual([
    [20, 34, 10, 38],
    [40, 35, 30, 50],
    [31, 38, 33, 44],
    [38, 15, 5, 42],
  ]);
});

test('renders OHLC bars as a custom series with ticks on a high-low stem', () => {
  const series = extractSeries(buildProps({ series_style: 'ohlc' }));
  expect(series[0].type).toBe('custom');
  expect(series[0].data).toEqual([
    {
      value: [0, 20, 34, 10, 38],
      itemStyle: { color: '#5ac189' },
    },
    {
      value: [1, 40, 35, 30, 50],
      itemStyle: { color: '#e04355' },
    },
    {
      value: [2, 31, 38, 33, 44],
      itemStyle: { color: '#5ac189' },
    },
    {
      value: [3, 38, 15, 5, 42],
      itemStyle: { color: '#e04355' },
    },
  ]);
});

test('draws OHLC open tick left, close tick right, and a high-low stem', () => {
  const { renderItem } = extractSeries(buildProps({ series_style: 'ohlc' }))[0];
  expect(renderItem).toBeDefined();
  const graphic = renderItem!(
    {},
    {
      value: (dim: number) => [0, 20, 34, 10, 38][dim],
      coord: ([x, y]: number[]) => [x * 10, 200 - y],
      size: () => [20, 0],
      visual: () => '#5ac189',
      style: (extra: Record<string, unknown>) => extra,
    },
  ) as {
    type: string;
    children: { type: string; shape: Record<string, number> }[];
  };
  expect(graphic.type).toBe('group');
  expect(graphic.children).toEqual([
    {
      type: 'line',
      shape: { x1: 0, y1: 190, x2: 0, y2: 162 },
      style: { stroke: '#5ac189' },
    },
    {
      type: 'line',
      shape: { x1: 0, y1: 180, x2: -7, y2: 180 },
      style: { stroke: '#5ac189' },
    },
    {
      type: 'line',
      shape: { x1: 0, y1: 166, x2: 7, y2: 166 },
      style: { stroke: '#5ac189' },
    },
  ]);
});

test('keeps moving averages on the close price in OHLC style', () => {
  const series = extractSeries(
    buildProps({ series_style: 'ohlc', moving_averages: [2] }),
  );
  expect(series[0].type).toBe('custom');
  expect(series[1].name).toBe('MA2');
  expect(series[1].data).toEqual(['-', 34.5, 36.5, 26.5]);
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

test('falls back to the temporal column when x_axis is unset but granularity_sqla is set', () => {
  // buildQuery.ts resolves the same way via getXAxisColumn; a chart saved or
  // imported without an explicit x_axis (unreachable interactively, but
  // reachable via the API or a YAML import) must query and read the same
  // column or every row collapses into one category.
  const rows = [
    { __timestamp: '2017-10-24', open: 20, close: 34, low: 10, high: 38 },
    { __timestamp: '2017-10-25', open: 40, close: 35, low: 30, high: 50 },
  ];
  const props = transform(rows, {
    x_axis: undefined,
    granularity_sqla: 'date',
  });
  const series = extractSeries(props);
  expect(series[0].data).toEqual([
    [20, 34, 10, 38],
    [40, 35, 30, 50],
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

test('keeps increase and decrease colors when Series has a single value', () => {
  const series = extractSeries(
    transform(
      [
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
          open: 40,
          close: 35,
          low: 30,
          high: 50,
        },
      ],
      { series: 'symbol' },
    ),
  );
  expect(series).toHaveLength(1);
  expect(series[0]).toEqual(
    expect.objectContaining({
      name: 'AAPL',
      itemStyle: {
        color: '#5ac189',
        color0: '#e04355',
        borderColor: '#5ac189',
        borderColor0: '#e04355',
      },
    }),
  );
});

test('uses filled and hollow series coloring when color by direction is off', () => {
  const colorScale = CategoricalColorNamespace.getScale('bnbColors');
  const series = extractSeries(buildProps({ color_by_direction: false }));
  const seriesColor = colorScale(CANDLESTICK_SERIES_NAME);
  expect(series[0]).toEqual(
    expect.objectContaining({
      itemStyle: {
        color: seriesColor,
        color0: supersetTheme.colorBgContainer,
        borderColor: seriesColor,
        borderColor0: seriesColor,
      },
    }),
  );
});

test('uses filled and hollow coloring for a single Series value when color by direction is off', () => {
  const colorScale = CategoricalColorNamespace.getScale('bnbColors');
  const series = extractSeries(
    transform(
      [
        {
          date: '2017-10-24',
          symbol: 'AAPL',
          open: 20,
          close: 34,
          low: 10,
          high: 38,
        },
      ],
      { series: 'symbol', color_by_direction: false },
    ),
  );
  const appleColor = colorScale('AAPL');
  expect(series[0]).toEqual(
    expect.objectContaining({
      name: 'AAPL',
      itemStyle: {
        color: appleColor,
        color0: supersetTheme.colorBgContainer,
        borderColor: appleColor,
        borderColor0: appleColor,
      },
    }),
  );
});

test('uses a unique series color with hollow decreasing candles when split by series', () => {
  const colorScale = CategoricalColorNamespace.getScale('bnbColors');
  const series = extractSeries(
    transform(
      [
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
      ],
      { series: 'symbol' },
    ),
  );
  const appleColor = colorScale('AAPL');
  const googleColor = colorScale('GOOG');
  expect(appleColor).not.toBe(googleColor);
  expect(series[0]).toEqual(
    expect.objectContaining({
      name: 'AAPL',
      itemStyle: {
        color: appleColor,
        color0: supersetTheme.colorBgContainer,
        borderColor: appleColor,
        borderColor0: appleColor,
      },
    }),
  );
  expect(series[1]).toEqual(
    expect.objectContaining({
      name: 'GOOG',
      itemStyle: {
        color: googleColor,
        color0: supersetTheme.colorBgContainer,
        borderColor: googleColor,
        borderColor0: googleColor,
      },
    }),
  );
});

test('uses a unique series color for every OHLC bar when split by series', () => {
  const colorScale = CategoricalColorNamespace.getScale('bnbColors');
  const series = extractSeries(
    transform(
      [
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
      ],
      { series: 'symbol', series_style: 'ohlc' },
    ),
  );
  const appleColor = colorScale('AAPL');
  expect(series[0].data).toEqual([
    {
      value: [0, 20, 34, 10, 38],
      itemStyle: { color: appleColor },
    },
  ]);
  expect(series[1].data).toEqual([
    {
      value: [0, 40, 35, 30, 50],
      itemStyle: { color: colorScale('GOOG') },
    },
  ]);
  expect(series[0].data[0]).not.toEqual(series[1].data[0]);
});

test('hides axes when showXAxis or showYAxis is false', () => {
  const { echartOptions } = buildProps({
    show_x_axis: false,
    show_y_axis: false,
  });
  expect((echartOptions.xAxis as { show: boolean }).show).toBe(false);
  expect((echartOptions.yAxis as { show: boolean }).show).toBe(false);
});

test('reserves bottom legend space on the bottom grid edge', () => {
  const { echartOptions } = buildProps({
    show_legend: true,
    legend_orientation: 'bottom',
    show_x_axis: false,
    show_y_axis: false,
    x_axis_title: 'Date',
    y_axis_title: 'Price',
  });
  const grid = echartOptions.grid as { left: number; bottom: number };
  expect(grid.bottom).toBe(40);
  expect(grid.left).toBe(20);
});

test('does not reserve title margins when axis titles are empty', () => {
  const { echartOptions } = buildProps({ show_legend: false });
  const grid = echartOptions.grid as {
    top: number;
    bottom: number;
    left: number;
    right: number;
  };
  expect(grid.top).toBe(20);
  expect(grid.bottom).toBe(20);
  expect(grid.left).toBe(20);
  expect(grid.right).toBe(20);
});

test('adds x-axis title margin to the bottom when the title is visible', () => {
  const { echartOptions } = buildProps({
    show_legend: false,
    x_axis_title: 'Date',
    x_axis_title_margin: 40,
  });
  const grid = echartOptions.grid as { bottom: number; left: number };
  expect(grid.bottom).toBe(60);
  expect(grid.left).toBe(20);
});

test('adds y-axis title margin to the top when the title position is Top', () => {
  const { echartOptions } = buildProps({
    show_legend: false,
    y_axis_title: 'Price',
    y_axis_title_margin: 50,
    y_axis_title_position: 'Top',
  });
  const grid = echartOptions.grid as { top: number; left: number };
  expect(grid.top).toBe(70);
  expect(grid.left).toBe(20);
});

test('adds y-axis title margin to the left when the title position is Left', () => {
  const { echartOptions } = buildProps({
    show_legend: false,
    y_axis_title: 'Price',
    y_axis_title_margin: 50,
    y_axis_title_position: 'Left',
  });
  const grid = echartOptions.grid as { top: number; left: number };
  expect(grid.top).toBe(20);
  expect(grid.left).toBe(70);
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
  // MA is available after N observations: first `period - 1` points are '-'.
  expect(series[1].data).toEqual(['-', 34.5, 36.5, 26.5]);
  expect(series[2].data).toEqual([
    '-',
    '-',
    35.666666666666664,
    29.333333333333332,
  ]);
  const colorScale = CategoricalColorNamespace.getScale('bnbColors');
  const ma2Color = colorScale('MA2');
  expect(series[1]).toEqual(
    expect.objectContaining({
      type: 'line',
      smooth: true,
      showSymbol: false,
      itemStyle: { color: ma2Color },
      lineStyle: { opacity: 0.5, color: ma2Color },
    }),
  );
});

test('keeps moving averages on the color scheme when candles use direction colors', () => {
  const colorScale = CategoricalColorNamespace.getScale('bnbColors');
  const ma2Color = colorScale('MA2');
  const series = extractSeries(buildProps({ moving_averages: [2] }));
  expect(series[0]).toEqual(
    expect.objectContaining({
      itemStyle: expect.objectContaining({
        color: '#5ac189',
        color0: '#e04355',
      }),
    }),
  );
  expect(series[1]).toEqual(
    expect.objectContaining({
      name: 'MA2',
      itemStyle: { color: ma2Color },
      lineStyle: { opacity: 0.5, color: ma2Color },
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
  const props = transform(seriesData, {
    series: 'symbol',
    moving_averages: [2],
  });
  expect(extractSeries(props).map(item => item.name)).toEqual([
    'AAPL',
    'GOOG',
    'AAPL MA2',
    'GOOG MA2',
  ]);
});

test('keeps a series moving average from gapping at a date only another series has', () => {
  const seriesData = [
    { date: '2017-10-24', symbol: 'A', open: 8, close: 10, low: 5, high: 12 },
    {
      date: '2017-10-24b',
      symbol: 'B',
      open: 900,
      close: 999,
      low: 800,
      high: 1000,
    },
    {
      date: '2017-10-25',
      symbol: 'A',
      open: 18,
      close: 20,
      low: 15,
      high: 22,
    },
    {
      date: '2017-10-26',
      symbol: 'A',
      open: 28,
      close: 30,
      low: 25,
      high: 32,
    },
  ];
  const props = transform(seriesData, {
    series: 'symbol',
    moving_averages: [2],
  });
  const series = extractSeries(props);
  const aMa = series.find(item => item.name === 'A MA2');
  // Union category order: A's first date, B's only date, then A's other two
  // dates. A has no candle at B's date, but its own two adjacent closes
  // (10, 20) should still average once both are seen, not blank out just
  // because B's date falls between them.
  expect(aMa?.data).toEqual(['-', null, 15, 25]);
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

test('keeps a SQL null x value distinct from a literal <NULL> category', () => {
  const props = transform([
    { date: null, open: 20, close: 34, low: 10, high: 38 },
    { date: NULL_STRING, open: 40, close: 35, low: 30, high: 50 },
  ]);
  expect((props.echartOptions.xAxis as { data: string[] }).data).toEqual([
    NULL_STRING,
    NULL_STRING,
  ]);
  expect(extractSeries(props)[0].data).toEqual([
    [20, 34, 10, 38],
    [40, 35, 30, 50],
  ]);
});

test('keeps a SQL null series value distinct from a literal <NULL> series', () => {
  const series = extractSeries(
    transform(
      [
        {
          date: '2017-10-24',
          symbol: null,
          open: 20,
          close: 34,
          low: 10,
          high: 38,
        },
        {
          date: '2017-10-24',
          symbol: NULL_STRING,
          open: 40,
          close: 35,
          low: 30,
          high: 50,
        },
      ],
      { series: 'symbol' },
    ),
  );
  expect(series).toHaveLength(2);
  expect(series[0].data).toEqual([[20, 34, 10, 38]]);
  expect(series[1].data).toEqual([[40, 35, 30, 50]]);
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
      seriesName: 'AAPL',
      value: [31, 38, 33, 44],
      data: [31, 38, 33, 44],
    },
    {
      dataIndex: 1,
      name: '2017-10-25',
      seriesType: 'candlestick',
      seriesName: 'GOOG',
      value: [38, 15, 5, 42],
      data: [38, 15, 5, 42],
    },
  ]);
  expect(tooltipHtml).toContain('2017-10-25');
  expect(tooltipHtml).not.toContain('2017-10-24');
  expect(tooltipHtml).toContain('AAPL');
  expect(tooltipHtml).toContain('GOOG');
});

test('drops incomplete OHLC rows', () => {
  const series = extractSeries(
    transform([
      { date: '2017-10-24', open: 20, close: 34, low: 10, high: 38 },
      { date: '2017-10-25', open: 40, close: 35, low: 30 },
    ]),
  );
  expect(series[0].data).toEqual([[20, 34, 10, 38], []]);
});

test('keeps category alignment with empty OHLC bars', () => {
  const series = extractSeries(
    transform(
      [
        { date: '2017-10-24', open: 20, close: 34, low: 10, high: 38 },
        { date: '2017-10-25', open: 40, close: 35, low: 30 },
      ],
      { series_style: 'ohlc' },
    ),
  );
  expect(series[0].data).toEqual([
    {
      value: [0, 20, 34, 10, 38],
      itemStyle: { color: '#5ac189' },
    },
    [],
  ]);
});

test('returns no points for empty query data', () => {
  const props = transform([]);
  expect((props.echartOptions.xAxis as { data: string[] }).data).toEqual([]);
  expect(extractSeries(props)[0].data).toEqual([]);
});

test('enables data zoom when zoomable is set', () => {
  const { echartOptions } = buildProps({ zoomable: true });
  expect(echartOptions.dataZoom).toHaveLength(2);
  expect((echartOptions.toolbox as { show: boolean }).show).toBe(true);
});

test('hides the tooltip while a context menu is open', () => {
  const props = transformProps({
    ...new ChartProps({
      formData,
      width: 800,
      height: 600,
      queriesData: [{ data }],
      theme: supersetTheme,
    }),
    inContextMenu: true,
  } as unknown as EchartsCandlestickChartProps);
  expect((props.echartOptions.tooltip as { show: boolean }).show).toBe(false);
});

test('uses an axis-triggered tooltip', () => {
  const { echartOptions } = buildProps();
  expect(echartOptions.tooltip).toEqual(
    expect.objectContaining({
      trigger: 'axis',
      axisPointer: { type: 'cross' },
    }),
  );
});

test('tooltip keeps the date as the heading and labels the price series with direction', () => {
  const props = buildProps({
    increase_label: 'Up',
    decrease_label: 'Down',
  });
  const increaseHtml = getTooltipHtml(props, [
    {
      dataIndex: 0,
      name: '2017-10-24',
      seriesType: 'candlestick',
      seriesName: CANDLESTICK_SERIES_NAME,
      value: [20, 34, 10, 38],
      data: [20, 34, 10, 38],
    },
  ]);
  expect(increaseHtml).toContain('2017-10-24');
  expect(increaseHtml).toContain(`${CANDLESTICK_SERIES_NAME} (Up)`);
  const decreaseHtml = getTooltipHtml(props, [
    {
      dataIndex: 3,
      name: '2017-10-27',
      seriesType: 'candlestick',
      seriesName: CANDLESTICK_SERIES_NAME,
      value: [38, 15, 5, 42],
      data: [38, 15, 5, 42],
    },
  ]);
  expect(decreaseHtml).toContain('2017-10-27');
  expect(decreaseHtml).toContain(`${CANDLESTICK_SERIES_NAME} (Down)`);
});

test('tooltip includes the custom series name when no series dimension is set', () => {
  const tooltipHtml = getTooltipHtml(
    buildProps({ candlestick_series_name: 'OHLC' }),
    [
      {
        dataIndex: 0,
        name: '2017-10-24',
        seriesType: 'candlestick',
        seriesName: 'OHLC',
        value: [20, 34, 10, 38],
        data: [20, 34, 10, 38],
      },
    ],
  );
  expect(tooltipHtml).toContain('OHLC (Increase)');
});

test('tooltip includes the series name when a series dimension has a single value', () => {
  const tooltipHtml = getTooltipHtml(
    transform(
      [
        {
          date: '2017-10-24',
          symbol: 'AAPL',
          open: 20,
          close: 34,
          low: 10,
          high: 38,
        },
      ],
      { series: 'symbol' },
    ),
    [
      {
        dataIndex: 0,
        name: '2017-10-24',
        seriesType: 'candlestick',
        seriesName: 'AAPL',
        value: [20, 34, 10, 38],
        data: [20, 34, 10, 38],
      },
    ],
  );
  expect(tooltipHtml).toContain('AAPL (Increase)');
});

test('tooltip omits a null moving-average point instead of showing 0', () => {
  const tooltipHtml = getTooltipHtml(buildProps({ moving_averages: [2] }), [
    {
      dataIndex: 1,
      name: '2017-10-25',
      seriesType: 'candlestick',
      value: [40, 35, 30, 50],
      data: [40, 35, 30, 50],
    },
    {
      dataIndex: 1,
      seriesType: 'line',
      seriesName: 'MA2',
      value: null,
    },
  ]);
  expect(tooltipHtml).not.toContain('MA2');
  expect(tooltipHtml).not.toMatch(/>0</);
});

test('tooltip includes moving-average line values', () => {
  const tooltipHtml = getTooltipHtml(buildProps({ moving_averages: [2] }), [
    {
      dataIndex: 1,
      name: '2017-10-25',
      seriesType: 'candlestick',
      value: [40, 35, 30, 50],
      data: [40, 35, 30, 50],
    },
    {
      dataIndex: 1,
      seriesType: 'line',
      seriesName: 'MA2',
      value: 34.5,
    },
  ]);
  expect(tooltipHtml).toContain('MA2');
  expect(tooltipHtml).toContain('34.5');
});

test('tooltip reads OHLC from custom-series 5-tuples', () => {
  const tooltipHtml = getTooltipHtml(buildProps({ series_style: 'ohlc' }), [
    {
      dataIndex: 0,
      name: '2017-10-24',
      seriesType: 'custom',
      seriesName: CANDLESTICK_SERIES_NAME,
      value: [0, 20, 34, 10, 38],
      data: [0, 20, 34, 10, 38],
    },
  ]);
  expect(tooltipHtml).toContain('20');
  expect(tooltipHtml).toContain('34');
  expect(tooltipHtml).toContain(`${CANDLESTICK_SERIES_NAME} (Increase)`);
});

test('tooltip lists every candlestick and moving average on the hovered date', () => {
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
  const tooltipHtml = getTooltipHtml(
    transform(seriesData, { series: 'symbol', moving_averages: [2] }),
    [
      {
        dataIndex: 1,
        name: '2017-10-25',
        seriesType: 'candlestick',
        seriesName: 'AAPL',
        value: [31, 38, 33, 44],
        data: [31, 38, 33, 44],
      },
      {
        dataIndex: 1,
        name: '2017-10-25',
        seriesType: 'candlestick',
        seriesName: 'GOOG',
        value: [38, 15, 5, 42],
        data: [38, 15, 5, 42],
      },
      {
        dataIndex: 1,
        seriesType: 'line',
        seriesName: 'AAPL MA2',
        value: 36,
      },
      {
        dataIndex: 1,
        seriesType: 'line',
        seriesName: 'GOOG MA2',
        value: 25,
      },
    ],
  );
  expect(tooltipHtml).toContain('AAPL (Increase)');
  expect(tooltipHtml).toContain('GOOG (Decrease)');
  expect(tooltipHtml).toContain('AAPL MA2');
  expect(tooltipHtml).toContain('GOOG MA2');
  expect(tooltipHtml).toContain('36');
  expect(tooltipHtml).toContain('25');
});

test('tooltip skips missing candles on the hovered date', () => {
  const tooltipHtml = getTooltipHtml(
    transform(
      [
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
      ],
      { series: 'symbol' },
    ),
    [
      {
        dataIndex: 1,
        name: '2017-10-25',
        seriesType: 'candlestick',
        seriesName: 'AAPL',
        value: [],
        data: [],
      },
      {
        dataIndex: 1,
        name: '2017-10-25',
        seriesType: 'candlestick',
        seriesName: 'GOOG',
        value: [40, 35, 30, 50],
        data: [40, 35, 30, 50],
      },
    ],
  );
  expect(tooltipHtml).toContain('GOOG');
  expect(tooltipHtml).not.toContain('AAPL');
});

test('tooltip returns an empty string when there is nothing to show', () => {
  expect(getTooltipHtml(buildProps(), [])).toBe('');
});

test('sorts legend items when legendSort is set', () => {
  const props = transform(
    [
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
    ],
    { series: 'symbol', legend_sort: 'desc' },
  );
  expect((props.echartOptions.legend as { data: string[] }).data).toEqual([
    'GOOG',
    'AAPL',
  ]);
});

test('merges custom echart options and ignores invalid JSON', () => {
  const merged = buildProps({
    echart_options: '{"title":{"text":"OHLC"}}',
  });
  expect(
    (merged.echartOptions.title as { text: string } | undefined)?.text,
  ).toBe('OHLC');

  const invalid = buildProps({ echart_options: 'not-json' });
  expect(extractSeries(invalid)[0].data).toHaveLength(4);
});
