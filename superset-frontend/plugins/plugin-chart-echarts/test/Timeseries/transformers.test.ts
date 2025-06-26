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
import { CategoricalColorScale } from '@superset-ui/core';
import type { SeriesOption } from 'echarts';
import { EchartsTimeseriesSeriesType } from '../../src';
import {
  transformSeries,
  transformNegativeLabelsPosition,
} from '../../src/Timeseries/transformers';

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
});

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
