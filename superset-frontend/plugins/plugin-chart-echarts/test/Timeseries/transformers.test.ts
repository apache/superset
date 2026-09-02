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
import {
  CategoricalColorScale,
  ChartProps,
  NumberFormatter,
  TimeGranularity,
  getNumberFormatter,
} from '@superset-ui/core';
import { GenericDataType } from '@apache-superset/core/common';
import { supersetTheme } from '@apache-superset/core/theme';
import { init, type SeriesOption } from 'echarts';
import type {
  BarSeriesOption,
  LineSeriesOption,
  ScatterSeriesOption,
} from 'echarts/charts';
import { BarValueLabelPosition, EchartsTimeseriesSeriesType } from '../../src';
import { StackControlsValue, TIMESERIES_CONSTANTS } from '../../src/constants';
import {
  LegendOrientation,
  EchartsTimeseriesChartProps,
} from '../../src/types';
import {
  transformSeries,
  transformNegativeLabelsPosition,
  getAutoBarLabelLayout,
  getPadding,
} from '../../src/Timeseries/transformers';
import transformProps from '../../src/Timeseries/transformProps';
import * as seriesUtils from '../../src/utils/series';

// Mock the colorScale function
const mockColorScale = jest.fn(
  (key: string, sliceId?: number) => `color-for-${key}-${sliceId}`,
) as unknown as CategoricalColorScale;

describe('transformSeries', () => {
  const series = { name: 'test-series' };

  test('should use the colorScaleKey if timeShiftColor is enabled', () => {
    const opts = {
      timeShiftColor: true,
      colorScaleKey: 'test-key',
      sliceId: 1,
    };

    const result = transformSeries(series, mockColorScale, 'test-key', opts);

    expect((result as any)?.itemStyle.color).toBe('color-for-test-key-1');
  });

  test('should use seriesKey if timeShiftColor is not enabled', () => {
    const opts = {
      timeShiftColor: false,
      seriesKey: 'series-key',
      sliceId: 2,
    };

    const result = transformSeries(series, mockColorScale, 'test-key', opts);

    expect((result as any)?.itemStyle.color).toBe('color-for-series-key-2');
  });

  test('should apply border styles for bar series with connectNulls', () => {
    const opts = {
      seriesType: EchartsTimeseriesSeriesType.Bar,
      connectNulls: true,
      timeShiftColor: false,
    };

    const result = transformSeries(series, mockColorScale, 'test-key', opts);

    expect((result as any).itemStyle.borderWidth).toBe(1.5);
    expect((result as any).itemStyle.borderType).toBe('dotted');
    expect((result as any).itemStyle.borderColor).toBe(
      (result as any).itemStyle.color,
    );
  });

  test('should not apply border styles for non-bar series', () => {
    const opts = {
      seriesType: EchartsTimeseriesSeriesType.Line,
      connectNulls: true,
      timeShiftColor: false,
    };

    const result = transformSeries(series, mockColorScale, 'test-key', opts);

    expect((result as any).itemStyle.borderWidth).toBe(0);
    expect((result as any).itemStyle.borderType).toBeUndefined();
    expect((result as any).itemStyle.borderColor).toBeUndefined();
  });

  test('should dim series when selectedValues does not include series name (dimension-based filtering)', () => {
    const opts = {
      filterState: { selectedValues: ['other-series'] },
      hasDimensions: true,
      seriesType: EchartsTimeseriesSeriesType.Bar,
      timeShiftColor: false,
    };

    const result = transformSeries(series, mockColorScale, 'test-key', opts);

    // OpacityEnum.SemiTransparent = 0.3
    expect((result as any).itemStyle.opacity).toBe(0.3);
  });

  test('should not dim series when hasDimensions is false (X-axis cross-filtering)', () => {
    const opts = {
      filterState: { selectedValues: ['Product A'] },
      hasDimensions: false,
      seriesType: EchartsTimeseriesSeriesType.Bar,
      timeShiftColor: false,
    };

    const result = transformSeries(series, mockColorScale, 'test-key', opts);

    // OpacityEnum.NonTransparent = 1 (not dimmed)
    expect((result as any).itemStyle.opacity).toBe(1);
  });

  test('should use symbolSizeFn for symbolSize when provided', () => {
    const symbolSizeFn = jest.fn(
      (value: (number | string | null)[]) => Number(value[1]) * 2,
    );
    const opts = {
      seriesType: EchartsTimeseriesSeriesType.Scatter,
      markerSize: 7,
      symbolSizeFn,
      timeShiftColor: false,
    };

    const result = transformSeries(series, mockColorScale, 'test-key', opts);

    const { symbolSize } = result as ScatterSeriesOption;
    expect(symbolSize).toBe(symbolSizeFn);
    expect(symbolSizeFn(['A', 4])).toBe(8);
  });

  test('should fall back to markerSize for symbolSize when symbolSizeFn is not provided', () => {
    const opts = {
      seriesType: EchartsTimeseriesSeriesType.Scatter,
      markerSize: 7,
      timeShiftColor: false,
    };

    const result = transformSeries(series, mockColorScale, 'test-key', opts);

    expect((result as ScatterSeriesOption).symbolSize).toBe(7);
  });

  test('does not render a per-series stacked label for a zero-value segment (#42702)', () => {
    const opts = {
      seriesType: EchartsTimeseriesSeriesType.Bar,
      stack: true,
      onlyTotal: false,
      isHorizontal: false,
      timeShiftColor: false,
      // percentage_threshold defaults to 0, so thresholdValues[dataIndex] is
      // 0 too — a value of exactly 0 would satisfy `numericValue >= (thresholdValues[dataIndex] || Number.MIN_SAFE_INTEGER)`
      // without the explicit `numericValue !== 0` guard.
      thresholdValues: [0],
      formatter: new NumberFormatter({
        id: 'test-formatter',
        formatFunc: (value: number) => `${value}`,
      }),
    };

    const result = transformSeries(series, mockColorScale, 'test-key', opts);
    const { formatter: labelFormatter } = (result as any).label;

    const zeroValueLabel = labelFormatter({
      value: [null, 0],
      dataIndex: 0,
      seriesIndex: 0,
      seriesName: 'test-series',
    });
    expect(zeroValueLabel).toBe('');

    const nonZeroValueLabel = labelFormatter({
      value: [null, 32],
      dataIndex: 0,
      seriesIndex: 0,
      seriesName: 'test-series',
    });
    expect(nonZeroValueLabel).toBe('32');
  });

  test('still renders a per-series stacked label for a genuine negative value that clears the threshold', () => {
    const opts = {
      seriesType: EchartsTimeseriesSeriesType.Bar,
      stack: true,
      onlyTotal: false,
      isHorizontal: false,
      timeShiftColor: false,
      // A category whose stacked total is itself negative produces a
      // negative threshold — a strictly-positive check would wrongly
      // suppress a real, meaningful negative-value label here.
      thresholdValues: [-10],
      formatter: new NumberFormatter({
        id: 'test-formatter',
        formatFunc: (value: number) => `${value}`,
      }),
    };

    const result = transformSeries(series, mockColorScale, 'test-key', opts);
    const { formatter: labelFormatter } = (result as any).label;

    const negativeValueLabel = labelFormatter({
      value: [null, -5],
      dataIndex: 0,
      seriesIndex: 0,
      seriesName: 'test-series',
    });
    expect(negativeValueLabel).toBe('-5');
  });
});

test('Auto bar labels move outside narrow stacked segments', () => {
  const result = transformSeries(
    { name: 'test-series', type: 'bar', data: [[2026, 1]] },
    mockColorScale,
    'test-key',
    {
      seriesType: EchartsTimeseriesSeriesType.Bar,
      stack: StackControlsValue.Stack,
      showValue: true,
    },
  ) as BarSeriesOption;
  const { labelLayout } = result;

  expect(result.label).toMatchObject({
    show: true,
    position: 'insideTop',
  });
  expect((result.label as { color?: string }).color).toBeUndefined();
  expect(typeof labelLayout).toBe('function');
  if (typeof labelLayout !== 'function') return;

  expect(
    labelLayout({
      dataIndex: 0,
      seriesIndex: 0,
      text: '1,000',
      align: 'center',
      verticalAlign: 'middle',
      rect: { x: 10, y: 20, width: 12, height: 20 },
      labelRect: { x: 1, y: 22, width: 30, height: 14 },
    }),
  ).toEqual({
    x: 16,
    y: 15,
    align: 'center',
    verticalAlign: 'bottom',
  });
});

test('Auto labels stay inside when both dimensions fit within 80% of the bar', () => {
  const result = transformSeries(
    { name: 'test-series', type: 'bar', data: [[2026, 1]] },
    mockColorScale,
    'test-key',
    { seriesType: EchartsTimeseriesSeriesType.Bar },
  ) as BarSeriesOption;
  const { labelLayout } = result;

  expect(typeof labelLayout).toBe('function');
  if (typeof labelLayout !== 'function') return;

  expect(
    labelLayout({
      dataIndex: 0,
      seriesIndex: 0,
      text: '1,000',
      align: 'center',
      verticalAlign: 'top',
      rect: { x: 10, y: 20, width: 50, height: 40 },
      labelRect: { x: 19, y: 25, width: 32, height: 14 },
    }),
  ).toEqual({});
});

test('Auto moves wide labels outside tall narrow vertical bars', () => {
  const result = transformSeries(
    { name: 'test-series', type: 'bar', data: [[2026, 100]] },
    mockColorScale,
    'test-key',
    { seriesType: EchartsTimeseriesSeriesType.Bar },
  ) as BarSeriesOption;
  const { labelLayout } = result;

  expect(typeof labelLayout).toBe('function');
  if (typeof labelLayout !== 'function') return;

  expect(
    labelLayout({
      dataIndex: 0,
      seriesIndex: 0,
      text: '1,000',
      align: 'center',
      verticalAlign: 'top',
      rect: { x: 10, y: 20, width: 12, height: 200 },
      labelRect: { x: 1, y: 25, width: 30, height: 14 },
    }),
  ).toEqual({
    x: 16,
    y: 15,
    align: 'center',
    verticalAlign: 'bottom',
  });
});

test('Auto overflow uses ECharts outside-label text color', () => {
  const darkBarColorScale = jest.fn(() => '#111111');
  const series = transformSeries(
    { name: 'test-series', type: 'bar', data: [[0, 123456789012]] },
    darkBarColorScale as unknown as CategoricalColorScale,
    'test-key',
    {
      formatter: getNumberFormatter('d'),
      seriesType: EchartsTimeseriesSeriesType.Bar,
      showValue: true,
    },
  ) as BarSeriesOption;
  const chart = init(null, null, {
    renderer: 'svg',
    ssr: true,
    width: 300,
    height: 220,
  });

  chart.setOption({
    animation: false,
    darkMode: false,
    xAxis: { type: 'category', data: ['A'], show: false },
    // A tall bar (well above the segment-legibility floor) whose 12-digit
    // label is too wide to fit inside, so ECharts still moves it outside.
    yAxis: { type: 'value', max: 250_000_000_000, show: false },
    series: [series],
  });

  expect(chart.renderToSVGString()).toMatch(
    /fill="#333"[^>]*>123456789012<\/text>/,
  );
  chart.dispose();
});

test('Auto bar labels use horizontal bar length and move to the value end', () => {
  const result = transformSeries(
    { name: 'test-series', type: 'bar', data: [[1, 2026]] },
    mockColorScale,
    'test-key',
    { seriesType: EchartsTimeseriesSeriesType.Bar, isHorizontal: true },
  ) as BarSeriesOption;
  const { labelLayout } = result;

  expect(typeof labelLayout).toBe('function');
  if (typeof labelLayout !== 'function') return;

  expect(
    labelLayout({
      dataIndex: 0,
      seriesIndex: 0,
      text: '1,000',
      align: 'right',
      verticalAlign: 'middle',
      rect: { x: 10, y: 20, width: 20, height: 12 },
      labelRect: { x: 0, y: 19, width: 30, height: 14 },
    }),
  ).toEqual({
    x: 35,
    y: 26,
    align: 'left',
    verticalAlign: 'middle',
  });
});

test.each([
  [BarValueLabelPosition.InsideEnd, 'insideTop'],
  [BarValueLabelPosition.OutsideEnd, 'top'],
  [BarValueLabelPosition.InsideCenter, 'inside'],
  [BarValueLabelPosition.InsideBase, 'insideBottom'],
] as const)(
  'manual %s bar labels use fixed position %s',
  (position, expected) => {
    const result = transformSeries(
      { name: 'test-series', type: 'bar', data: [[2026, 1]] },
      mockColorScale,
      'test-key',
      {
        seriesType: EchartsTimeseriesSeriesType.Bar,
        valueLabelPosition: position,
        theme: supersetTheme,
      },
    ) as BarSeriesOption;

    expect(result.labelLayout).toBeUndefined();
    expect(result.label).toMatchObject({ position: expected });
    if (position === BarValueLabelPosition.OutsideEnd) {
      expect(result.label).toMatchObject({ color: supersetTheme.colorText });
    } else {
      expect(result.label).not.toHaveProperty('color');
    }
  },
);

test('manual Outside End positions negative stacked segments below the bar', () => {
  const result = transformSeries(
    { name: 'test-series', type: 'bar', data: [[2026, -1]] },
    mockColorScale,
    'test-key',
    {
      seriesType: EchartsTimeseriesSeriesType.Bar,
      stack: StackControlsValue.Stack,
      valueLabelPosition: BarValueLabelPosition.OutsideEnd,
    },
  ) as BarSeriesOption;

  expect(result.data).toEqual([
    {
      value: [2026, -1],
      label: { position: 'bottom' },
    },
  ]);
  expect(result.labelLayout).toBeUndefined();
});

test('Auto positions negative stacked segments at their inside end', () => {
  const result = transformSeries(
    { name: 'test-series', type: 'bar', data: [[2026, -1]] },
    mockColorScale,
    'test-key',
    {
      seriesType: EchartsTimeseriesSeriesType.Bar,
      stack: StackControlsValue.Stack,
    },
  ) as BarSeriesOption;

  expect(result.data).toEqual([
    {
      value: [2026, -1],
      label: { position: 'insideBottom' },
    },
  ]);
  expect(typeof result.labelLayout).toBe('function');
  if (typeof result.labelLayout !== 'function') return;
  expect(
    result.labelLayout({
      dataIndex: 0,
      seriesIndex: 0,
      text: '-1,000',
      align: 'center',
      verticalAlign: 'bottom',
      rect: { x: 10, y: 20, width: 12, height: 30 },
      labelRect: { x: 1, y: 35, width: 30, height: 14 },
    }),
  ).toEqual({
    x: 16,
    y: 55,
    align: 'center',
    verticalAlign: 'top',
  });
});

test('Auto moves horizontal negative labels beyond their value end', () => {
  const result = transformSeries(
    { name: 'test-series', type: 'bar', data: [[-1, 2026]] },
    mockColorScale,
    'test-key',
    { seriesType: EchartsTimeseriesSeriesType.Bar, isHorizontal: true },
  ) as BarSeriesOption;

  expect(result.data).toEqual([
    {
      value: [-1, 2026],
      label: { position: 'insideLeft' },
    },
  ]);
  expect(typeof result.labelLayout).toBe('function');
  if (typeof result.labelLayout !== 'function') return;
  expect(
    result.labelLayout({
      dataIndex: 0,
      seriesIndex: 0,
      text: '-1,000',
      align: 'left',
      verticalAlign: 'middle',
      rect: { x: 10, y: 20, width: 20, height: 12 },
      labelRect: { x: 10, y: 19, width: 30, height: 14 },
    }),
  ).toEqual({
    x: 5,
    y: 26,
    align: 'right',
    verticalAlign: 'middle',
  });
});

test('Auto label layout does not change non-Bar series', () => {
  const result = transformSeries(
    { name: 'test-series', type: 'line', data: [[2026, 1]] },
    mockColorScale,
    'test-key',
    {
      seriesType: EchartsTimeseriesSeriesType.Line,
      theme: supersetTheme,
    },
  ) as LineSeriesOption;

  expect(result).not.toHaveProperty('labelLayout');
  expect(result.label).toMatchObject({
    position: 'top',
    color: supersetTheme.colorText,
  });
});

test('Auto suppresses the label for a vertical segment below the legibility floor', () => {
  // A 10px-tall stacked segment can't legibly fit its 14px-tall label inside
  // or outside without colliding with a neighboring segment's label.
  expect(
    getAutoBarLabelLayout(
      {
        dataIndex: 0,
        seriesIndex: 0,
        text: '0.14',
        align: 'center',
        verticalAlign: 'middle',
        rect: { x: 10, y: 20, width: 40, height: 10 },
        labelRect: { x: 12, y: 22, width: 20, height: 14 },
      },
      false,
    ),
  ).toEqual({ fontSize: 0 });
});

test('Auto keeps placing labels normally for a vertical segment at the legibility floor', () => {
  expect(
    getAutoBarLabelLayout(
      {
        dataIndex: 0,
        seriesIndex: 0,
        text: '0.14',
        align: 'center',
        verticalAlign: 'middle',
        rect: { x: 10, y: 20, width: 40, height: 16 },
        labelRect: { x: 12, y: 22, width: 20, height: 14 },
      },
      false,
    ),
  ).not.toEqual({ fontSize: 0 });
});

test('Auto suppresses the label for a horizontal segment below the legibility floor', () => {
  // Horizontal bars stack along the x axis, so the value-axis dimension that
  // matters is rect.width rather than rect.height.
  expect(
    getAutoBarLabelLayout(
      {
        dataIndex: 0,
        seriesIndex: 0,
        text: '0.14',
        align: 'left',
        verticalAlign: 'middle',
        rect: { x: 10, y: 20, width: 10, height: 40 },
        labelRect: { x: 12, y: 22, width: 20, height: 14 },
      },
      true,
    ),
  ).toEqual({ fontSize: 0 });
});

test('Auto suppresses labels for tiny adjacent stacked segments end to end', () => {
  const result = transformSeries(
    { name: 'test-series', type: 'bar', data: [[2026, 0.14]] },
    mockColorScale,
    'test-key',
    {
      seriesType: EchartsTimeseriesSeriesType.Bar,
      stack: StackControlsValue.Stack,
      showValue: true,
    },
  ) as BarSeriesOption;
  const { labelLayout } = result;

  expect(typeof labelLayout).toBe('function');
  if (typeof labelLayout !== 'function') return;

  expect(
    labelLayout({
      dataIndex: 0,
      seriesIndex: 0,
      text: '0.14',
      align: 'center',
      verticalAlign: 'middle',
      rect: { x: 10, y: 20, width: 40, height: 8 },
      labelRect: { x: 12, y: 22, width: 20, height: 14 },
    }),
  ).toEqual({ fontSize: 0 });
});

test.each([
  [BarValueLabelPosition.InsideEnd, 'insideTop'],
  [BarValueLabelPosition.OutsideEnd, 'top'],
  [BarValueLabelPosition.InsideCenter, 'inside'],
  [BarValueLabelPosition.InsideBase, 'insideBottom'],
] as const)(
  'manual %s label placement is unaffected by tiny segments (no labelLayout applied)',
  (position, expected) => {
    const result = transformSeries(
      { name: 'test-series', type: 'bar', data: [[2026, 0.14]] },
      mockColorScale,
      'test-key',
      {
        seriesType: EchartsTimeseriesSeriesType.Bar,
        stack: StackControlsValue.Stack,
        valueLabelPosition: position,
        showValue: true,
        theme: supersetTheme,
      },
    ) as BarSeriesOption;

    // Manual positions don't use the fit-aware labelLayout callback at all,
    // so a tiny segment can't trigger the Auto-only suppression behavior.
    expect(result.labelLayout).toBeUndefined();
    expect(result.label).toMatchObject({ position: expected });
  },
);

describe('transformNegativeLabelsPosition', () => {
  test('label position bottom of negative value no Horizontal', () => {
    const isHorizontal = false;
    const series: SeriesOption = {
      data: [
        [2020, 1],
        [2021, 3],
        [2022, -2],
        [2023, -5],
        [2024, 4],
      ],
      type: EchartsTimeseriesSeriesType.Bar,
      stack: undefined,
    };
    const result =
      Array.isArray(series.data) && series.type === 'bar' && !series.stack
        ? transformNegativeLabelsPosition(series, isHorizontal)
        : series.data;
    expect((result as any)[0].label).toBe(undefined);
    expect((result as any)[1].label).toBe(undefined);
    expect((result as any)[2].label.position).toBe('outside');
    expect((result as any)[3].label.position).toBe('outside');
    expect((result as any)[4].label).toBe(undefined);
  });

  test('label position left of negative value is Horizontal', () => {
    const isHorizontal = true;
    const series: SeriesOption = {
      data: [
        [1, 2020],
        [-3, 2021],
        [2, 2022],
        [-4, 2023],
        [-6, 2024],
      ],
      type: EchartsTimeseriesSeriesType.Bar,
      stack: undefined,
    };

    const result =
      Array.isArray(series.data) && series.type === 'bar' && !series.stack
        ? transformNegativeLabelsPosition(series, isHorizontal)
        : series.data;
    expect((result as any)[0].label).toBe(undefined);
    expect((result as any)[1].label.position).toBe('outside');
    expect((result as any)[2].label).toBe(undefined);
    expect((result as any)[3].label.position).toBe('outside');
    expect((result as any)[4].label.position).toBe('outside');
  });

  test('label position to line type', () => {
    const isHorizontal = false;
    const series: SeriesOption = {
      data: [
        [2020, 1],
        [2021, 3],
        [2022, -2],
        [2023, -5],
        [2024, 4],
      ],
      type: EchartsTimeseriesSeriesType.Line,
      stack: undefined,
    };

    const result =
      Array.isArray(series.data) &&
      !series.stack &&
      series.type !== 'line' &&
      series.type === 'bar'
        ? transformNegativeLabelsPosition(series, isHorizontal)
        : series.data;
    expect((result as any)[0].label).toBe(undefined);
    expect((result as any)[1].label).toBe(undefined);
    expect((result as any)[2].label).toBe(undefined);
    expect((result as any)[3].label).toBe(undefined);
    expect((result as any)[4].label).toBe(undefined);
  });

  test('label position to bar type and stack', () => {
    const isHorizontal = false;
    const series: SeriesOption = {
      data: [
        [2020, 1],
        [2021, 3],
        [2022, -2],
        [2023, -5],
        [2024, 4],
      ],
      type: EchartsTimeseriesSeriesType.Bar,
      stack: 'obs',
    };

    const result =
      Array.isArray(series.data) && series.type === 'bar' && !series.stack
        ? transformNegativeLabelsPosition(series, isHorizontal)
        : series.data;
    expect((result as any)[0].label).toBe(undefined);
    expect((result as any)[1].label).toBe(undefined);
    expect((result as any)[2].label).toBe(undefined);
    expect((result as any)[3].label).toBe(undefined);
    expect((result as any)[4].label).toBe(undefined);
  });
});

function buildTimeseriesChartProps(
  overrides: Record<string, unknown> = {},
): EchartsTimeseriesChartProps {
  return new ChartProps({
    formData: {
      colorScheme: 'bnbColors',
      datasource: '3__table',
      granularity_sqla: 'ds',
      timeGrainSqla: TimeGranularity.MONTH,
      metric: 'sum__num',
      viz_type: 'my_viz',
      ...overrides,
    },
    width: 800,
    height: 600,
    queriesData: [
      {
        data: [
          { sum__num: 100, __timestamp: new Date('2026-01-01').getTime() },
          { sum__num: 200, __timestamp: new Date('2026-04-01').getTime() },
          { sum__num: 300, __timestamp: new Date('2026-07-01').getTime() },
          { sum__num: 400, __timestamp: new Date('2026-10-01').getTime() },
          { sum__num: 500, __timestamp: new Date('2026-12-01').getTime() },
        ],
        colnames: ['sum__num', '__timestamp'],
        coltypes: [GenericDataType.Numeric, GenericDataType.Temporal],
      },
    ],
    theme: supersetTheme,
  }) as unknown as EchartsTimeseriesChartProps;
}

test('should configure time axis labels to show max label for last month visibility', () => {
  const formData = {
    colorScheme: 'bnbColors',
    datasource: '3__table',
    granularity_sqla: 'ds',
    timeGrainSqla: TimeGranularity.MONTH,
    metric: 'sum__num',
    viz_type: 'my_viz',
  };
  const queriesData = [
    {
      data: [
        { sum__num: 100, __timestamp: new Date('2026-01-01').getTime() },
        { sum__num: 200, __timestamp: new Date('2026-02-01').getTime() },
        { sum__num: 300, __timestamp: new Date('2026-03-01').getTime() },
        { sum__num: 400, __timestamp: new Date('2026-04-01').getTime() },
        { sum__num: 500, __timestamp: new Date('2026-05-01').getTime() },
      ],
      colnames: ['sum__num', '__timestamp'],
      coltypes: [GenericDataType.Numeric, GenericDataType.Temporal],
    },
  ];
  const chartProps = new ChartProps({
    formData,
    width: 800,
    height: 600,
    queriesData,
    theme: supersetTheme,
  });

  const result = transformProps(
    chartProps as unknown as EchartsTimeseriesChartProps,
  );

  expect(result.echartOptions.xAxis).toEqual(
    expect.objectContaining({
      axisLabel: expect.objectContaining({
        showMaxLabel: true,
        alignMaxLabel: 'right',
      }),
    }),
  );
});

test('#39899 - x-axis dates do not overlap and last label stays visible at 0° rotation', () => {
  const result = transformProps(buildTimeseriesChartProps());
  const { axisLabel } = result.echartOptions.xAxis as Record<string, any>;

  // showMaxLabel forces the last data point label to render
  expect(axisLabel.showMaxLabel).toBe(true);
  expect(axisLabel.alignMaxLabel).toBe('right');
  // hideOverlap must be OFF so ECharts cannot suppress the forced max label
  expect(axisLabel.hideOverlap).toBe(false);
});

test('#39899 - closely spaced x-axis time labels do not visually overlap', () => {
  const formData = {
    colorScheme: 'bnbColors',
    datasource: '3__table',
    granularity_sqla: 'ds',
    timeGrainSqla: TimeGranularity.MINUTE,
    x_axis_time_format: '%Y-%m-%d %H:%M:%S',
    metric: 'sum__num',
    viz_type: 'my_viz',
  };
  const startTime = new Date('2026-01-01T00:00:00Z').getTime();
  const data = Array.from({ length: 20 }, (_, i) => ({
    sum__num: i,
    __timestamp: startTime + i * 60 * 1000,
  }));
  const chartProps = new ChartProps({
    formData,
    width: 300,
    height: 400,
    queriesData: [
      {
        data,
        colnames: ['sum__num', '__timestamp'],
        coltypes: [GenericDataType.Numeric, GenericDataType.Temporal],
      },
    ],
    theme: supersetTheme,
  });

  const result = transformProps(
    chartProps as unknown as EchartsTimeseriesChartProps,
  );
  const { axisLabel } = result.echartOptions.xAxis as Record<string, any>;
  const labels = data.map(({ __timestamp }) =>
    axisLabel.formatter(__timestamp),
  );

  // hideOverlap must stay off so ECharts' own collision detection can never
  // suppress the forced boundary label (#39899 must not regress).
  expect(axisLabel.hideOverlap).toBe(false);
  // The formatter itself must thin out labels that are too close together to
  // render legibly in the available width.
  expect(labels.filter(label => label === '').length).toBeGreaterThan(0);
  // The first and last labels are the forced axis boundaries and must always
  // stay visible.
  expect(labels[0]).not.toBe('');
  expect(labels[labels.length - 1]).not.toBe('');
});

test('last x-axis date is visible and not cut off when rotated -45°', () => {
  const lastDataPointTimestamp = new Date('2026-12-01').getTime();
  const result = transformProps(
    buildTimeseriesChartProps({
      xAxisLabelRotation: -45,
      x_axis_time_format: '%d-%m-%Y %H:%M:%S',
    }),
  );
  const { xAxis, grid } = result.echartOptions as Record<string, any>;
  const { axisLabel } = xAxis;

  // The formatter renders the last data point's date as a full string
  const lastDateLabel = axisLabel.formatter(lastDataPointTimestamp);
  expect(lastDateLabel).toMatch(/01-12-2026/);
  expect(lastDateLabel).not.toBe('');

  // Labels are not aggressively hidden so the last date stays visible
  expect(axisLabel.hideOverlap).toBe(false);
  expect(axisLabel.rotate).toBe(-45);
  // No phantom label at a position that doesn't correspond to any bar
  expect(axisLabel.showMaxLabel).toBeUndefined();
  // Enough right padding so the last rotated label is not clipped
  expect(grid.right).toBeGreaterThan(TIMESERIES_CONSTANTS.gridOffsetRight);
});

test('last x-axis date is visible and not cut off when rotated 45°', () => {
  const lastDataPointTimestamp = new Date('2026-12-01').getTime();
  const result = transformProps(
    buildTimeseriesChartProps({
      xAxisLabelRotation: 45,
      x_axis_time_format: '%d-%m-%Y %H:%M:%S',
    }),
  );
  const { xAxis, grid } = result.echartOptions as Record<string, any>;

  const lastDateLabel = xAxis.axisLabel.formatter(lastDataPointTimestamp);
  expect(lastDateLabel).toMatch(/01-12-2026/);
  expect(lastDateLabel).not.toBe('');

  expect(xAxis.axisLabel.hideOverlap).toBe(false);
  expect(xAxis.axisLabel.rotate).toBe(45);
  expect(grid.right).toBeGreaterThan(TIMESERIES_CONSTANTS.gridOffsetRight);
});

test('no phantom date label appears at the axis boundary', () => {
  const result = transformProps(
    buildTimeseriesChartProps({ xAxisLabelRotation: -45 }),
  );
  const { axisLabel } = result.echartOptions.xAxis as Record<string, any>;

  expect(axisLabel.showMaxLabel).toBeUndefined();
  expect(axisLabel.showMinLabel).toBeUndefined();
});

function setupGetChartPaddingMock(): jest.SpyInstance {
  // Mock getChartPadding to return the padding object as-is for easier testing
  const getChartPaddingSpy = jest.spyOn(seriesUtils, 'getChartPadding');
  getChartPaddingSpy.mockImplementation(
    (
      show: boolean,
      orientation: LegendOrientation,
      margin: string | number | null | undefined,
      padding:
        | {
            bottom?: number;
            left?: number;
            right?: number;
            top?: number;
          }
        | undefined,
    ) => ({
      bottom: padding?.bottom ?? 0,
      left: padding?.left ?? 0,
      right: padding?.right ?? 0,
      top: padding?.top ?? 0,
    }),
  );
  return getChartPaddingSpy;
}

test('getPadding should only affect left margin when Y axis title position is Left', () => {
  const getChartPaddingSpy = setupGetChartPaddingMock();
  try {
    const result = getPadding(
      false, // showLegend
      LegendOrientation.Top, // legendOrientation
      true, // addYAxisTitleOffset
      false, // zoomable
      null, // margin
      false, // addXAxisTitleOffset
      'Left', // yAxisTitlePosition
      30, // yAxisTitleMargin
      0, // xAxisTitleMargin
      false, // isHorizontal
    );

    // Top should be base value, not affected by Left position
    expect(result.top).toBe(TIMESERIES_CONSTANTS.gridOffsetTop);
    // Left should include the margin
    expect(result.left).toBe(TIMESERIES_CONSTANTS.gridOffsetLeft + 30);
    // Bottom should be base value
    expect(result.bottom).toBe(TIMESERIES_CONSTANTS.gridOffsetBottom);
    // Right should be base value
    expect(result.right).toBe(TIMESERIES_CONSTANTS.gridOffsetRight);
  } finally {
    getChartPaddingSpy.mockRestore();
  }
});

test('getPadding should only affect top margin when Y axis title position is Top', () => {
  const getChartPaddingSpy = setupGetChartPaddingMock();
  try {
    const result = getPadding(
      false, // showLegend
      LegendOrientation.Top, // legendOrientation
      true, // addYAxisTitleOffset
      false, // zoomable
      null, // margin
      false, // addXAxisTitleOffset
      'Top', // yAxisTitlePosition
      30, // yAxisTitleMargin
      0, // xAxisTitleMargin
      false, // isHorizontal
    );

    // Top should include the margin
    expect(result.top).toBe(TIMESERIES_CONSTANTS.gridOffsetTop + 30);
    // Left should be base value, not affected by Top position
    expect(result.left).toBe(TIMESERIES_CONSTANTS.gridOffsetLeft);
    // Bottom should be base value
    expect(result.bottom).toBe(TIMESERIES_CONSTANTS.gridOffsetBottom);
    // Right should be base value
    expect(result.right).toBe(TIMESERIES_CONSTANTS.gridOffsetRight);
  } finally {
    getChartPaddingSpy.mockRestore();
  }
});

test('getPadding should use yAxisOffset for top when position is not specified and addYAxisTitleOffset is true', () => {
  const getChartPaddingSpy = setupGetChartPaddingMock();
  try {
    const result = getPadding(
      false, // showLegend
      LegendOrientation.Top, // legendOrientation
      true, // addYAxisTitleOffset
      false, // zoomable
      null, // margin
      false, // addXAxisTitleOffset
      undefined, // yAxisTitlePosition (not specified)
      0, // yAxisTitleMargin
      0, // xAxisTitleMargin
      false, // isHorizontal
    );

    // Top should include yAxisOffset
    expect(result.top).toBe(
      TIMESERIES_CONSTANTS.gridOffsetTop +
        TIMESERIES_CONSTANTS.yAxisLabelTopOffset,
    );
    // Left should be base value
    expect(result.left).toBe(TIMESERIES_CONSTANTS.gridOffsetLeft);
  } finally {
    getChartPaddingSpy.mockRestore();
  }
});

test('getPadding should not add yAxisOffset when addYAxisTitleOffset is false', () => {
  const getChartPaddingSpy = setupGetChartPaddingMock();
  try {
    const result = getPadding(
      false, // showLegend
      LegendOrientation.Top, // legendOrientation
      false, // addYAxisTitleOffset
      false, // zoomable
      null, // margin
      false, // addXAxisTitleOffset
      undefined, // yAxisTitlePosition
      0, // yAxisTitleMargin
      0, // xAxisTitleMargin
      false, // isHorizontal
    );

    // Top should be base value only
    expect(result.top).toBe(TIMESERIES_CONSTANTS.gridOffsetTop);
    // Left should be base value
    expect(result.left).toBe(TIMESERIES_CONSTANTS.gridOffsetLeft);
  } finally {
    getChartPaddingSpy.mockRestore();
  }
});

test('getPadding should handle Left position with zero margin correctly', () => {
  const getChartPaddingSpy = setupGetChartPaddingMock();
  try {
    const result = getPadding(
      false, // showLegend
      LegendOrientation.Top, // legendOrientation
      true, // addYAxisTitleOffset
      false, // zoomable
      null, // margin
      false, // addXAxisTitleOffset
      'Left', // yAxisTitlePosition
      0, // yAxisTitleMargin (zero)
      0, // xAxisTitleMargin
      false, // isHorizontal
    );

    // Top should be base value, not affected
    expect(result.top).toBe(TIMESERIES_CONSTANTS.gridOffsetTop);
    // Left should be base value only (margin is 0)
    expect(result.left).toBe(TIMESERIES_CONSTANTS.gridOffsetLeft);
  } finally {
    getChartPaddingSpy.mockRestore();
  }
});

/**
 * #42702: a stacked segment with no height starts and ends at the same
 * coordinate as the top of the segment beneath it, so a value label on it is
 * drawn over that segment's label. `percentage_threshold` does not filter these
 * out: it defaults to 0, and `thresholdValues[dataIndex] || MIN_SAFE_INTEGER`
 * turns a 0 threshold into "no filtering", which is intentional.
 */
const stackedLabel = (
  numericValue: number | null,
  opts: Record<string, unknown> = {},
) => {
  const series = transformSeries(
    { id: 'B', name: 'B', data: [[1, numericValue]] } as SeriesOption,
    mockColorScale,
    'B',
    {
      seriesType: EchartsTimeseriesSeriesType.Bar,
      stack: StackControlsValue.Stack,
      showValue: true,
      onlyTotal: false,
      formatter: getNumberFormatter(),
      thresholdValues: [0],
      ...opts,
    },
  ) as SeriesOption & {
    label: { formatter: (params: unknown) => string };
  };
  return series.label.formatter({
    value: [1, numericValue],
    dataIndex: 0,
    seriesIndex: 1,
    seriesName: 'B',
  });
};

test('stacked value labels are omitted for a zero-height segment', () => {
  expect(stackedLabel(0)).toBe('');
  expect(stackedLabel(null)).toBe('');
});

test('stacked value labels are kept for segments that have height', () => {
  expect(stackedLabel(32)).toBe('32');
  expect(stackedLabel(-5)).toBe('-5');
});

test('a zero value keeps its label when the series is not stacked', () => {
  // Without a stack the label sits on the bar itself, so there is nothing for
  // it to collide with.
  expect(stackedLabel(0, { stack: undefined })).toBe('0');
});

test('percentage_threshold still filters values below the threshold', () => {
  // 10% of a 100 total. The zero-height guard must not swallow this rule.
  expect(stackedLabel(5, { thresholdValues: [10] })).toBe('');
  expect(stackedLabel(50, { thresholdValues: [10] })).toBe('50');
});

test('only-total labels are unaffected by the zero-height guard', () => {
  expect(
    stackedLabel(0, {
      onlyTotal: true,
      showValueIndexes: [1],
      totalStackedValues: [32],
    }),
  ).toBe('32');
});
