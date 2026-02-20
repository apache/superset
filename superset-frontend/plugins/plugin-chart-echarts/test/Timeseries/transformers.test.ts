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
import { CategoricalColorScale, ChartProps } from '@superset-ui/core';
import { GenericDataType } from '@apache-superset/core/api/core';
import { supersetTheme } from '@apache-superset/core/ui';
import type { SeriesOption } from 'echarts';
import { EchartsTimeseriesSeriesType } from '../../src';
import { TIMESERIES_CONSTANTS } from '../../src/constants';
import {
  LegendOrientation,
  EchartsTimeseriesChartProps,
} from '../../src/types';
import {
  transformSeries,
  optimizeBarLabelPlacement,
  getPadding,
} from '../../src/Timeseries/transformers';
import transformProps from '../../src/Timeseries/transformProps';
import * as seriesUtils from '../../src/utils/series';

// Mock the colorScale function to return different colors based on key
const mockColorScale = jest.fn((key: string) => {
  if (key === 'test-key') return '#1f77b4'; // blue
  if (key === 'series-key') return '#ff7f0e'; // orange
  return '#2ca02c'; // green for any other key
}) as unknown as CategoricalColorScale;

describe('transformSeries', () => {
  const series = { name: 'test-series' };

  test('should use the colorScaleKey if timeShiftColor is enabled', () => {
    const opts = {
      timeShiftColor: true,
      colorScaleKey: 'test-key',
      sliceId: 1,
    };

    const result = transformSeries(series, mockColorScale, 'test-key', opts);

    expect(mockColorScale).toHaveBeenCalledWith('test-key', 1);
    expect((result as any)?.itemStyle.color).toBe('#1f77b4');
  });

  test('should use seriesKey if timeShiftColor is not enabled', () => {
    const opts = {
      timeShiftColor: false,
      seriesKey: 'series-key',
      sliceId: 2,
    };

    const result = transformSeries(series, mockColorScale, 'test-key', opts);

    expect(mockColorScale).toHaveBeenCalledWith('series-key', 2);
    expect((result as any)?.itemStyle.color).toBe('#ff7f0e');
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
});

describe('optimizeBarLabelPlacement', () => {
  test('label position for non-stacked vertical charts', () => {
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
    const result = optimizeBarLabelPlacement(series, isHorizontal);
    expect((result as any)[0].label.position).toBe('insideTop');
    expect((result as any)[1].label.position).toBe('insideTop');
    expect((result as any)[2].label.position).toBe('insideBottom');
    expect((result as any)[3].label.position).toBe('insideBottom');
    expect((result as any)[4].label.position).toBe('insideTop');
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

    const result = optimizeBarLabelPlacement(series, isHorizontal);
    expect((result as any)[0].label.position).toBe('insideRight');
    expect((result as any)[1].label.position).toBe('insideLeft');
    expect((result as any)[2].label.position).toBe('insideRight');
    expect((result as any)[3].label.position).toBe('insideLeft');
    expect((result as any)[4].label.position).toBe('insideLeft');
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
        ? optimizeBarLabelPlacement(series, isHorizontal)
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

    const result = optimizeBarLabelPlacement(series, isHorizontal);
    expect((result as any)[0].label.position).toBe('insideTop');
    expect((result as any)[1].label.position).toBe('insideTop');
    expect((result as any)[2].label.position).toBe('insideBottom');
    expect((result as any)[3].label.position).toBe('insideBottom');
    expect((result as any)[4].label.position).toBe('insideTop');
  });

  test('label position for horizontal stacked charts', () => {
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
      stack: 'obs',
    };

    const result = optimizeBarLabelPlacement(series, isHorizontal);
    expect((result as any)[0].label.position).toBe('insideRight');
    expect((result as any)[1].label.position).toBe('insideLeft');
    expect((result as any)[2].label.position).toBe('insideRight');
    expect((result as any)[3].label.position).toBe('insideLeft');
    expect((result as any)[4].label.position).toBe('insideLeft');
  });
});

test('should configure time axis labels to show max label for last month visibility', () => {
  const formData = {
    colorScheme: 'bnbColors',
    datasource: '3__table',
    granularity_sqla: 'ds',
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
