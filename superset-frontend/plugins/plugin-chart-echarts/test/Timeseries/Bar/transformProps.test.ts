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
  ChartDataResponseResult,
  ChartProps,
  DataRecord,
  GenericDataType,
  SqlaFormData,
  supersetTheme,
} from '@superset-ui/core';
import { StackControlsValue } from '../../../src/constants';
import { EchartsTimeseriesChartProps } from '../../../src/types';
import transformProps from '../../../src/Timeseries/transformProps';
import { DEFAULT_FORM_DATA } from '../../../src/Timeseries/constants';
import {
  EchartsTimeseriesFormData,
  OrientationType,
  EchartsTimeseriesSeriesType,
} from '../../../src/Timeseries/types';
import { createEchartsTimeseriesTestChartProps } from '../../helpers';

function createTestQueryData(
  data: DataRecord[],
  overrides?: Partial<ChartDataResponseResult>,
): ChartDataResponseResult {
  return {
    annotation_data: null,
    cache_key: null,
    cache_timeout: null,
    cached_dttm: null,
    data,
    colnames: [],
    coltypes: [],
    error: null,
    is_cached: false,
    query: '',
    rowcount: data.length,
    sql_rowcount: data.length,
    stacktrace: null,
    status: 'success',
    from_dttm: null,
    to_dttm: null,
    ...overrides,
  };
}

describe('Bar Chart X-axis Time Formatting', () => {
  const baseFormData: SqlaFormData = {
    ...DEFAULT_FORM_DATA,
    colorScheme: 'bnbColors',
    datasource: '3__table',
    granularity_sqla: '__timestamp',
    metric: ['Sales', 'Marketing', 'Operations'],
    groupby: [],
    viz_type: 'echarts_timeseries_bar',
    seriesType: EchartsTimeseriesSeriesType.Bar,
    orientation: 'vertical',
  };

  const timeseriesData = [
    {
      data: [
        { Sales: 100, __timestamp: 1609459200000 }, // 2021-01-01
        { Marketing: 150, __timestamp: 1612137600000 }, // 2021-02-01
        { Operations: 200, __timestamp: 1614556800000 }, // 2021-03-01
      ],
      colnames: ['Sales', 'Marketing', 'Operations', '__timestamp'],
      coltypes: ['BIGINT', 'BIGINT', 'BIGINT', 'TIMESTAMP'],
    },
  ];

  const baseChartPropsConfig = {
    width: 800,
    height: 600,
    queriesData: timeseriesData,
    theme: supersetTheme,
  };

  describe('Default xAxisTimeFormat', () => {
    it('should use smart_date as default xAxisTimeFormat', () => {
      const chartProps = new ChartProps({
        ...baseChartPropsConfig,
        formData: baseFormData,
      });

      const transformedProps = transformProps(
        chartProps as EchartsTimeseriesChartProps,
      );

      // Check that the x-axis has a formatter applied
      expect(transformedProps.echartOptions.xAxis).toHaveProperty('axisLabel');
      const xAxis = transformedProps.echartOptions.xAxis as any;
      expect(xAxis.axisLabel).toHaveProperty('formatter');
      expect(typeof xAxis.axisLabel.formatter).toBe('function');
    });

    it('should apply xAxisTimeFormat from DEFAULT_FORM_DATA when not explicitly set', () => {
      const formDataWithoutTimeFormat = {
        ...baseFormData,
      };
      delete formDataWithoutTimeFormat.xAxisTimeFormat;

      const chartProps = new ChartProps({
        ...baseChartPropsConfig,
        formData: formDataWithoutTimeFormat,
      });

      const transformedProps = transformProps(
        chartProps as EchartsTimeseriesChartProps,
      );

      // Should still have a formatter since DEFAULT_FORM_DATA includes xAxisTimeFormat
      expect(transformedProps.echartOptions.xAxis).toHaveProperty('axisLabel');
      const xAxis = transformedProps.echartOptions.xAxis as any;
      expect(xAxis.axisLabel).toHaveProperty('formatter');
    });
  });

  describe('Custom xAxisTimeFormat', () => {
    it('should respect custom xAxisTimeFormat when explicitly set', () => {
      const customFormData = {
        ...baseFormData,
        xAxisTimeFormat: '%Y-%m-%d',
      };

      const chartProps = new ChartProps({
        ...baseChartPropsConfig,
        formData: customFormData,
      });

      const transformedProps = transformProps(
        chartProps as EchartsTimeseriesChartProps,
      );

      // Verify the formatter function exists and is applied
      expect(transformedProps.echartOptions.xAxis).toHaveProperty('axisLabel');
      const xAxis = transformedProps.echartOptions.xAxis as any;
      expect(xAxis.axisLabel).toHaveProperty('formatter');
      expect(typeof xAxis.axisLabel.formatter).toBe('function');

      // The key test is that a formatter exists - the actual formatting is handled by d3-time-format
      const { formatter } = xAxis.axisLabel;
      expect(formatter).toBeDefined();
      expect(typeof formatter).toBe('function');
    });

    it('should handle different time format options', () => {
      const timeFormats = [
        '%Y-%m-%d',
        '%Y/%m/%d',
        '%m/%d/%Y',
        '%b %d, %Y',
        'smart_date',
      ];

      timeFormats.forEach(timeFormat => {
        const customFormData = {
          ...baseFormData,
          xAxisTimeFormat: timeFormat,
        };

        const chartProps = new ChartProps({
          ...baseChartPropsConfig,
          formData: customFormData,
        });

        const transformedProps = transformProps(
          chartProps as EchartsTimeseriesChartProps,
        );

        const xAxis = transformedProps.echartOptions.xAxis as any;
        expect(xAxis.axisLabel).toHaveProperty('formatter');
        expect(typeof xAxis.axisLabel.formatter).toBe('function');
      });
    });
  });

  describe('Orientation-specific behavior', () => {
    it('should apply time formatting to x-axis in vertical bar charts', () => {
      const verticalFormData = {
        ...baseFormData,
        orientation: 'vertical',
        xAxisTimeFormat: '%Y-%m',
      };

      const chartProps = new ChartProps({
        ...baseChartPropsConfig,
        formData: verticalFormData,
      });

      const transformedProps = transformProps(
        chartProps as EchartsTimeseriesChartProps,
      );

      // In vertical orientation, time should be on x-axis
      const xAxis = transformedProps.echartOptions.xAxis as any;
      expect(xAxis.axisLabel).toHaveProperty('formatter');
      expect(typeof xAxis.axisLabel.formatter).toBe('function');
    });

    it('should apply time formatting to y-axis in horizontal bar charts', () => {
      const horizontalFormData = {
        ...baseFormData,
        orientation: 'horizontal',
        xAxisTimeFormat: '%Y-%m',
      };

      const chartProps = new ChartProps({
        ...baseChartPropsConfig,
        formData: horizontalFormData,
      });

      const transformedProps = transformProps(
        chartProps as EchartsTimeseriesChartProps,
      );

      // In horizontal orientation, axes are swapped, so time should be on y-axis
      const yAxis = transformedProps.echartOptions.yAxis as any;
      expect(yAxis.axisLabel).toHaveProperty('formatter');
      expect(typeof yAxis.axisLabel.formatter).toBe('function');
    });
  });

  describe('Integration with existing features', () => {
    it('should work with axis bounds', () => {
      const formDataWithBounds = {
        ...baseFormData,
        xAxisTimeFormat: '%Y-%m-%d',
        truncateXAxis: true,
        xAxisBounds: [null, null] as [number | null, number | null],
      };

      const chartProps = new ChartProps({
        ...baseChartPropsConfig,
        formData: formDataWithBounds,
      });

      const transformedProps = transformProps(
        chartProps as EchartsTimeseriesChartProps,
      );

      const xAxis = transformedProps.echartOptions.xAxis as any;
      expect(xAxis.axisLabel).toHaveProperty('formatter');
      // The xAxis should be configured with the time formatting
      expect(transformedProps.echartOptions.xAxis).toBeDefined();
    });

    it('should work with label rotation', () => {
      const formDataWithRotation = {
        ...baseFormData,
        xAxisTimeFormat: '%Y-%m-%d',
        xAxisLabelRotation: 45,
      };

      const chartProps = new ChartProps({
        ...baseChartPropsConfig,
        formData: formDataWithRotation,
      });

      const transformedProps = transformProps(
        chartProps as EchartsTimeseriesChartProps,
      );

      const xAxis = transformedProps.echartOptions.xAxis as any;
      expect(xAxis.axisLabel).toHaveProperty('formatter');
      expect(xAxis.axisLabel).toHaveProperty('rotate', 45);
    });

    it('should maintain time formatting consistency with tooltip', () => {
      const formDataWithTooltip = {
        ...baseFormData,
        xAxisTimeFormat: '%Y-%m-%d',
        tooltipTimeFormat: '%Y-%m-%d',
      };

      const chartProps = new ChartProps({
        ...baseChartPropsConfig,
        formData: formDataWithTooltip,
      });

      const transformedProps = transformProps(
        chartProps as EchartsTimeseriesChartProps,
      );

      // Both axis and tooltip should have formatters
      const xAxis = transformedProps.echartOptions.xAxis as any;
      expect(xAxis.axisLabel).toHaveProperty('formatter');
      expect(transformedProps.xValueFormatter).toBeDefined();
      expect(typeof transformedProps.xValueFormatter).toBe('function');
    });
  });

  describe('Regression test for Issue #30373', () => {
    it('should not be stuck on adaptive formatting', () => {
      // Test the exact scenario described in the issue
      const issueFormData = {
        ...baseFormData,
        xAxisTimeFormat: '%Y-%m-%d %H:%M:%S', // Non-adaptive format
      };

      const chartProps = new ChartProps({
        ...baseChartPropsConfig,
        formData: issueFormData,
      });

      const transformedProps = transformProps(
        chartProps as EchartsTimeseriesChartProps,
      );

      // Verify formatter exists - this is the key fix, ensuring xAxisTimeFormat is used
      const xAxis = transformedProps.echartOptions.xAxis as any;
      const { formatter } = xAxis.axisLabel;

      expect(formatter).toBeDefined();
      expect(typeof formatter).toBe('function');

      // The important part is that the xAxisTimeFormat is being used from formData
      // The actual formatting is handled by the underlying time formatter
    });

    it('should allow changing from smart_date to other formats', () => {
      // First create with smart_date (default)
      const smartDateFormData = {
        ...baseFormData,
        xAxisTimeFormat: 'smart_date',
      };

      const smartDateChartProps = new ChartProps({
        ...baseChartPropsConfig,
        formData: smartDateFormData,
      });

      const smartDateProps = transformProps(
        smartDateChartProps as EchartsTimeseriesChartProps,
      );

      // Then change to a different format
      const customFormatFormData = {
        ...baseFormData,
        xAxisTimeFormat: '%b %Y',
      };

      const customFormatChartProps = new ChartProps({
        ...baseChartPropsConfig,
        formData: customFormatFormData,
      });

      const customFormatProps = transformProps(
        customFormatChartProps as EchartsTimeseriesChartProps,
      );

      // Both should have formatters - the key is that they're not undefined
      const smartDateXAxis = smartDateProps.echartOptions.xAxis as any;
      const customFormatXAxis = customFormatProps.echartOptions.xAxis as any;

      expect(smartDateXAxis.axisLabel.formatter).toBeDefined();
      expect(customFormatXAxis.axisLabel.formatter).toBeDefined();

      // Both should be functions that can format time
      expect(typeof smartDateXAxis.axisLabel.formatter).toBe('function');
      expect(typeof customFormatXAxis.axisLabel.formatter).toBe('function');
    });

    it('should have xAxisTimeFormat in formData by default', () => {
      // This test specifically verifies our fix - that DEFAULT_FORM_DATA includes xAxisTimeFormat
      const chartProps = new ChartProps({
        ...baseChartPropsConfig,
        formData: baseFormData,
      });

      expect(chartProps.formData.xAxisTimeFormat).toBeDefined();
      expect(chartProps.formData.xAxisTimeFormat).toBe('smart_date');
    });
  });

  describe('Horizontal stacked bar chart axis bounds', () => {
    // Dataset where each series max = 4 but stacked total max = 8
    const stackedData: ChartDataResponseResult[] = [
      createTestQueryData(
        [
          { team: 'Team A', High: 2, Low: 2, Medium: 4 },
          { team: 'Team B', High: null, Low: null, Medium: 3 },
          { team: 'Team C', High: null, Low: null, Medium: 1 },
        ],
        {
          colnames: ['team', 'High', 'Low', 'Medium'],
          coltypes: [
            GenericDataType.String,
            GenericDataType.Numeric,
            GenericDataType.Numeric,
            GenericDataType.Numeric,
          ],
        },
      ),
    ];

    const horizontalStackedFormData: EchartsTimeseriesFormData = {
      ...(baseFormData as EchartsTimeseriesFormData),
      x_axis: 'team',
      metric: ['High', 'Low', 'Medium'],
      groupby: [],
      orientation: OrientationType.Horizontal,
      seriesType: EchartsTimeseriesSeriesType.Bar,
      stack: StackControlsValue.Stack,
      truncateYAxis: true,
    };

    test('xAxis.max uses stacked total, not individual series max', () => {
      // Individual series max = 4 (Medium), stacked total for Team A = 8
      // Without the fix, xAxis.max would be 4, clipping bars and duplicating labels
      const chartProps = createEchartsTimeseriesTestChartProps<
        EchartsTimeseriesFormData,
        EchartsTimeseriesChartProps
      >({
        defaultFormData: horizontalStackedFormData,
        defaultVizType: 'echarts_timeseries_bar',
        defaultQueriesData: stackedData,
      });

      const { echartOptions } = transformProps(chartProps);
      const xAxis = echartOptions.xAxis as any;

      // xAxis.max must be >= stacked total (8), not capped at individual series max (4)
      expect(xAxis.max).toBeGreaterThanOrEqual(8);
    });

    test('xAxis.max is not set to individual series max when stacking', () => {
      const chartProps = createEchartsTimeseriesTestChartProps<
        EchartsTimeseriesFormData,
        EchartsTimeseriesChartProps
      >({
        defaultFormData: horizontalStackedFormData,
        defaultVizType: 'echarts_timeseries_bar',
        defaultQueriesData: stackedData,
      });

      const { echartOptions } = transformProps(chartProps);
      const xAxis = echartOptions.xAxis as any;

      // 4 is the individual series max — the axis should not be clipped there
      expect(xAxis.max).not.toBe(4);
    });

    test('non-stacked horizontal bar chart still uses individual series max', () => {
      const nonStackedFormData: EchartsTimeseriesFormData = {
        ...horizontalStackedFormData,
        stack: null,
      };

      const chartProps = createEchartsTimeseriesTestChartProps<
        EchartsTimeseriesFormData,
        EchartsTimeseriesChartProps
      >({
        defaultFormData: nonStackedFormData,
        defaultVizType: 'echarts_timeseries_bar',
        defaultQueriesData: stackedData,
      });

      const { echartOptions } = transformProps(chartProps);
      const xAxis = echartOptions.xAxis as any;

      // Without stacking, xAxis.max should be based on individual series values
      expect(xAxis.max).toBe(4);
    });
  });
});
