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
import { EchartsTimeseriesSeriesType } from '@superset-ui/plugin-chart-echarts';
import { transformSeries } from '../../src/Timeseries/transformers';

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
