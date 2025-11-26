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
import { HeatmapChartProps, HeatmapFormData } from '../../src/Heatmap/types';
import transformProps from '../../src/Heatmap/transformProps';

describe('Heatmap transformProps', () => {
  const baseFormData: HeatmapFormData = {
    datasource: '5__table',
    viz_type: 'heatmap',
    xAxis: 'day_of_week',
    groupby: ['hour'],
    metric: 'count',
    linearColorScheme: 'blue_white_yellow',
    normalized: false,
    normalizeAcross: 'heatmap',
    borderColor: { r: 255, g: 255, b: 255, a: 1 },
    borderWidth: 1,
    showLegend: true,
    showValues: false,
    showPercentage: false,
    legendType: 'continuous',
    bottomMargin: 'auto',
    leftMargin: 'auto',
    xscaleInterval: 1,
    yscaleInterval: 1,
    xAxisLabelRotation: 0,
    valueBounds: [null, null],
  };

  const sparseData = [
    { day_of_week: 'Monday', hour: 9, count: 10 },
    { day_of_week: 'Monday', hour: 14, count: 15 },
    { day_of_week: 'Wednesday', hour: 11, count: 8 },
    { day_of_week: 'Friday', hour: 16, count: 20 },
    { day_of_week: 'Tuesday', hour: 10, count: 12 },
    { day_of_week: 'Thursday', hour: 15, count: 18 },
  ];

  const createChartProps = (
    formDataOverrides: Partial<HeatmapFormData> = {},
    data: Record<string, any>[] = sparseData,
  ) =>
    new ChartProps({
      formData: { ...baseFormData, ...formDataOverrides },
      width: 800,
      height: 600,
      queriesData: [
        {
          data,
          colnames: ['day_of_week', 'hour', 'count'],
          coltypes: [0, 0, 0],
        },
      ],
      theme: supersetTheme,
    });

  test('should sort x-axis alphabetically ascending', () => {
    const chartProps = createChartProps({ sortXAxis: 'alpha_asc' });
    const result = transformProps(chartProps as HeatmapChartProps);

    expect(result.echartOptions.xAxis).toHaveProperty('data');
    const xAxisData = (result.echartOptions.xAxis as any).data;
    expect(xAxisData).toEqual([
      'Friday',
      'Monday',
      'Thursday',
      'Tuesday',
      'Wednesday',
    ]);
  });

  test('should sort x-axis alphabetically descending', () => {
    const chartProps = createChartProps({ sortXAxis: 'alpha_desc' });
    const result = transformProps(chartProps as HeatmapChartProps);

    const xAxisData = (result.echartOptions.xAxis as any).data;
    expect(xAxisData).toEqual([
      'Wednesday',
      'Tuesday',
      'Thursday',
      'Monday',
      'Friday',
    ]);
  });

  test('should sort y-axis alphabetically ascending', () => {
    const chartProps = createChartProps({ sortYAxis: 'alpha_asc' });
    const result = transformProps(chartProps as HeatmapChartProps);

    const yAxisData = (result.echartOptions.yAxis as any).data;
    // Hours are numbers, so alphabetical is actually numeric in this case
    expect(yAxisData).toEqual([10, 11, 14, 15, 16, 9]);
  });

  test('should sort y-axis alphabetically descending', () => {
    const chartProps = createChartProps({ sortYAxis: 'alpha_desc' });
    const result = transformProps(chartProps as HeatmapChartProps);

    const yAxisData = (result.echartOptions.yAxis as any).data;
    expect(yAxisData).toEqual([9, 16, 15, 14, 11, 10]);
  });

  test('should sort x-axis by metric value ascending', () => {
    const chartProps = createChartProps({ sortXAxis: 'value_asc' });
    const result = transformProps(chartProps as HeatmapChartProps);

    const xAxisData = (result.echartOptions.xAxis as any).data;
    // Wednesday(8) < Tuesday(12) < Thursday(18) < Friday(20) < Monday(25=10+15)
    expect(xAxisData).toEqual([
      'Wednesday',
      'Tuesday',
      'Thursday',
      'Friday',
      'Monday',
    ]);
  });

  test('should sort x-axis by metric value descending', () => {
    const chartProps = createChartProps({ sortXAxis: 'value_desc' });
    const result = transformProps(chartProps as HeatmapChartProps);

    const xAxisData = (result.echartOptions.xAxis as any).data;
    // Monday(25) > Friday(20) > Thursday(18) > Tuesday(12) > Wednesday(8)
    expect(xAxisData).toEqual([
      'Monday',
      'Friday',
      'Thursday',
      'Tuesday',
      'Wednesday',
    ]);
  });

  test('should sort y-axis by metric value ascending', () => {
    const chartProps = createChartProps({ sortYAxis: 'value_asc' });
    const result = transformProps(chartProps as HeatmapChartProps);

    const yAxisData = (result.echartOptions.yAxis as any).data;
    // 11(8) < 9(10) < 10(12) < 14(15) < 15(18) < 16(20)
    expect(yAxisData).toEqual([11, 9, 10, 14, 15, 16]);
  });

  test('should sort y-axis by metric value descending', () => {
    const chartProps = createChartProps({ sortYAxis: 'value_desc' });
    const result = transformProps(chartProps as HeatmapChartProps);

    const yAxisData = (result.echartOptions.yAxis as any).data;
    // 16(20) > 15(18) > 14(15) > 10(12) > 9(10) > 11(8)
    expect(yAxisData).toEqual([16, 15, 14, 10, 9, 11]);
  });

  test('should handle both axes sorted simultaneously', () => {
    const chartProps = createChartProps({
      sortXAxis: 'alpha_asc',
      sortYAxis: 'value_desc',
    });
    const result = transformProps(chartProps as HeatmapChartProps);

    const xAxisData = (result.echartOptions.xAxis as any).data;
    const yAxisData = (result.echartOptions.yAxis as any).data;

    expect(xAxisData).toEqual([
      'Friday',
      'Monday',
      'Thursday',
      'Tuesday',
      'Wednesday',
    ]);
    expect(yAxisData).toEqual([16, 15, 14, 10, 9, 11]);
  });

  test('should handle no sort option specified', () => {
    const chartProps = createChartProps({});
    const result = transformProps(chartProps as HeatmapChartProps);

    const xAxisData = (result.echartOptions.xAxis as any).data;
    const yAxisData = (result.echartOptions.yAxis as any).data;

    // Should maintain order of first appearance
    expect(xAxisData).toEqual([
      'Monday',
      'Wednesday',
      'Friday',
      'Tuesday',
      'Thursday',
    ]);
    expect(yAxisData).toEqual([9, 14, 11, 16, 10, 15]);
  });

  test('should aggregate metric values for value-based sorting', () => {
    const dataWithDuplicates = [
      { day_of_week: 'Monday', hour: 9, count: 10 },
      { day_of_week: 'Monday', hour: 10, count: 15 },
      { day_of_week: 'Tuesday', hour: 9, count: 5 },
      { day_of_week: 'Tuesday', hour: 10, count: 3 },
      { day_of_week: 'Wednesday', hour: 9, count: 20 },
    ];

    const chartProps = createChartProps(
      { sortXAxis: 'value_asc' },
      dataWithDuplicates,
    );
    const result = transformProps(chartProps as HeatmapChartProps);

    const xAxisData = (result.echartOptions.xAxis as any).data;
    // Tuesday(8) < Wednesday(20) < Monday(25)
    expect(xAxisData).toEqual(['Tuesday', 'Wednesday', 'Monday']);
  });

  test('should handle data with null values', () => {
    const dataWithNulls: Record<string, any>[] = [
      { day_of_week: 'Monday', hour: 9, count: 10 },
      { day_of_week: null, hour: 10, count: 15 },
      { day_of_week: 'Tuesday', hour: null, count: 8 },
    ];

    const chartProps = createChartProps(
      { sortXAxis: 'alpha_asc' },
      dataWithNulls,
    );
    const result = transformProps(chartProps as HeatmapChartProps);

    const xAxisData = (result.echartOptions.xAxis as any).data;
    // Only non-null values should appear
    expect(xAxisData).toEqual(['Monday', 'Tuesday']);
  });

  test('should preserve axis data structure for ECharts consumption', () => {
    const chartProps = createChartProps({ sortXAxis: 'alpha_asc' });
    const result = transformProps(chartProps as HeatmapChartProps);

    expect(result.echartOptions).toHaveProperty('xAxis');
    expect(result.echartOptions).toHaveProperty('yAxis');
    expect(result.echartOptions.xAxis).toMatchObject({
      type: 'category',
      data: expect.any(Array),
      axisLabel: expect.any(Object),
    });
    expect(result.echartOptions.yAxis).toMatchObject({
      type: 'category',
      data: expect.any(Array),
      axisLabel: expect.any(Object),
    });
  });
});
