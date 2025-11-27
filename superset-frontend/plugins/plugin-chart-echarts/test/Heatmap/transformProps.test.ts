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

  test('should sort axes alphabetically in both directions', () => {
    // X-axis ascending
    const xAscProps = createChartProps({ sortXAxis: 'alpha_asc' });
    const xAscResult = transformProps(xAscProps as HeatmapChartProps);
    expect(xAscResult.echartOptions.xAxis).toHaveProperty('data');
    expect((xAscResult.echartOptions.xAxis as any).data).toEqual([
      'Friday',
      'Monday',
      'Thursday',
      'Tuesday',
      'Wednesday',
    ]);

    // X-axis descending
    const xDescProps = createChartProps({ sortXAxis: 'alpha_desc' });
    const xDescResult = transformProps(xDescProps as HeatmapChartProps);
    expect((xDescResult.echartOptions.xAxis as any).data).toEqual([
      'Wednesday',
      'Tuesday',
      'Thursday',
      'Monday',
      'Friday',
    ]);

    // Y-axis ascending (numeric)
    const yAscProps = createChartProps({ sortYAxis: 'alpha_asc' });
    const yAscResult = transformProps(yAscProps as HeatmapChartProps);
    // Hours are numbers, so they should be sorted numerically
    expect((yAscResult.echartOptions.yAxis as any).data).toEqual([
      9, 10, 11, 14, 15, 16,
    ]);

    // Y-axis descending (numeric)
    const yDescProps = createChartProps({ sortYAxis: 'alpha_desc' });
    const yDescResult = transformProps(yDescProps as HeatmapChartProps);
    // Numeric descending order
    expect((yDescResult.echartOptions.yAxis as any).data).toEqual([
      16, 15, 14, 11, 10, 9,
    ]);
  });

  test('should sort axes by metric value', () => {
    const chartPropsXAsc = createChartProps({ sortXAxis: 'value_asc' });
    const resultXAsc = transformProps(chartPropsXAsc as HeatmapChartProps);
    // Wednesday(8) < Tuesday(12) < Thursday(18) < Friday(20) < Monday(25=10+15)
    expect((resultXAsc.echartOptions.xAxis as any).data).toEqual([
      'Wednesday',
      'Tuesday',
      'Thursday',
      'Friday',
      'Monday',
    ]);

    const chartPropsXDesc = createChartProps({ sortXAxis: 'value_desc' });
    const resultXDesc = transformProps(chartPropsXDesc as HeatmapChartProps);
    // Monday(25) > Friday(20) > Thursday(18) > Tuesday(12) > Wednesday(8)
    expect((resultXDesc.echartOptions.xAxis as any).data).toEqual([
      'Monday',
      'Friday',
      'Thursday',
      'Tuesday',
      'Wednesday',
    ]);

    const chartPropsYAsc = createChartProps({ sortYAxis: 'value_asc' });
    const resultYAsc = transformProps(chartPropsYAsc as HeatmapChartProps);
    // 11(8) < 9(10) < 10(12) < 14(15) < 15(18) < 16(20)
    expect((resultYAsc.echartOptions.yAxis as any).data).toEqual([
      11, 9, 10, 14, 15, 16,
    ]);

    const chartPropsYDesc = createChartProps({ sortYAxis: 'value_desc' });
    const resultYDesc = transformProps(chartPropsYDesc as HeatmapChartProps);
    // 16(20) > 15(18) > 14(15) > 10(12) > 9(10) > 11(8)
    expect((resultYDesc.echartOptions.yAxis as any).data).toEqual([
      16, 15, 14, 10, 9, 11,
    ]);
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

  test('should sort numeric values numerically not alphabetically', () => {
    const numericData = [
      { hour: 1, day: 'Mon', count: 10 },
      { hour: 10, day: 'Mon', count: 15 },
      { hour: 2, day: 'Tue', count: 8 },
      { hour: 20, day: 'Wed', count: 12 },
      { hour: 3, day: 'Thu', count: 18 },
    ];

    const chartProps = createChartProps(
      { sortXAxis: 'alpha_asc', xAxis: 'hour', groupby: ['day'] },
      numericData,
    );

    // Override colnames to match the new data structure
    (chartProps as any).queriesData[0].colnames = ['hour', 'day', 'count'];

    const result = transformProps(chartProps as HeatmapChartProps);

    const xAxisData = (result.echartOptions.xAxis as any).data;
    // Should be numeric order: 1, 2, 3, 10, 20
    // NOT alphabetical order: 1, 10, 2, 20, 3
    expect(xAxisData).toEqual([1, 2, 3, 10, 20]);
  });

  test('should convert series data to axis indices', () => {
    const chartProps = createChartProps({
      sortXAxis: 'alpha_asc',
      sortYAxis: 'alpha_asc',
    });
    const result = transformProps(chartProps as HeatmapChartProps);

    const seriesData = (result.echartOptions.series as any)[0].data;

    // Each data point should be [xIndex, yIndex, value]
    expect(Array.isArray(seriesData)).toBe(true);
    expect(seriesData.length).toBeGreaterThan(0);

    // Check that data points use indices (numbers starting from 0)
    seriesData.forEach((point: any) => {
      expect(Array.isArray(point)).toBe(true);
      expect(point.length).toBe(3);
      // Indices should be numbers
      expect(typeof point[0]).toBe('number');
      expect(typeof point[1]).toBe('number');
      // Indices should be >= 0
      expect(point[0]).toBeGreaterThanOrEqual(0);
      expect(point[1]).toBeGreaterThanOrEqual(0);
    });
  });

  test('should handle mixed numeric and string values in axes', () => {
    const mixedData = [
      { category: 'A', value: 1, count: 10 },
      { category: 'B', value: 10, count: 15 },
      { category: 'C', value: 2, count: 8 },
    ];

    const chartProps = createChartProps(
      {
        sortXAxis: 'alpha_asc',
        sortYAxis: 'alpha_asc',
        xAxis: 'category',
        groupby: ['value'],
      },
      mixedData,
    );

    (chartProps as any).queriesData[0].colnames = [
      'category',
      'value',
      'count',
    ];

    const result = transformProps(chartProps as HeatmapChartProps);

    const xAxisData = (result.echartOptions.xAxis as any).data;
    const yAxisData = (result.echartOptions.yAxis as any).data;

    // X-axis: strings sorted alphabetically
    expect(xAxisData).toEqual(['A', 'B', 'C']);
    // Y-axis: numbers sorted numerically (1, 2, 10 NOT 1, 10, 2)
    expect(yAxisData).toEqual([1, 2, 10]);
  });
});
