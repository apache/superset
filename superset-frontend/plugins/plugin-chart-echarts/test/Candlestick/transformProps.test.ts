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
    series: { name: string; data: unknown[] }[];
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

test('reserves bottom legend space on the bottom grid edge', () => {
  const { echartOptions } = buildProps({
    show_legend: true,
    legend_orientation: 'bottom',
    show_x_axis: false,
    show_y_axis: false,
    x_axis_title_margin: 0,
    y_axis_title_margin: 0,
  });
  const grid = echartOptions.grid as { left: number; bottom: number };
  // sizeUnit * 3 (hidden X axis) + default bottom legend margin (20)
  expect(grid.bottom).toBe(32);
  expect(grid.left).toBe(8);
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
      value: [31, 38, 33, 44],
      data: [31, 38, 33, 44],
    },
  ]);
  expect(tooltipHtml).toContain('2017-10-25');
  expect(tooltipHtml).not.toContain('2017-10-24');
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

test('tooltip heading uses increase or decrease based on open vs close', () => {
  const props = buildProps({
    increase_label: 'Up',
    decrease_label: 'Down',
  });
  expect(
    getTooltipHtml(props, [
      {
        dataIndex: 0,
        name: '2017-10-24',
        seriesType: 'candlestick',
        value: [20, 34, 10, 38],
        data: [20, 34, 10, 38],
      },
    ]),
  ).toContain('Up');
  expect(
    getTooltipHtml(props, [
      {
        dataIndex: 3,
        name: '2017-10-27',
        seriesType: 'candlestick',
        value: [38, 15, 5, 42],
        data: [38, 15, 5, 42],
      },
    ]),
  ).toContain('Down');
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
