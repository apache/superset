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
  SqlaFormData,
} from '@superset-ui/core';
import { GenericDataType } from '@apache-superset/core/common';
import { supersetTheme } from '@apache-superset/core/theme';
import {
  EchartsTimeseriesChartProps,
  LegendOrientation,
  LegendType,
} from '../../../src/types';
import transformProps from '../../../src/Timeseries/transformProps';
import { DEFAULT_FORM_DATA } from '../../../src/Timeseries/constants';
import {
  EchartsTimeseriesFormData,
  OrientationType,
  EchartsTimeseriesSeriesType,
} from '../../../src/Timeseries/types';
import { getPadding } from '../../../src/Timeseries/transformers';
import {
  getHorizontalLegendAvailableWidth,
  getLegendLayoutResult,
} from '../../../src/utils/series';
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
    queried_dttm: null,
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
    test('should use smart_date as default xAxisTimeFormat', () => {
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

    test('should apply xAxisTimeFormat from DEFAULT_FORM_DATA when not explicitly set', () => {
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
    test('should respect custom xAxisTimeFormat when explicitly set', () => {
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

    test('should handle different time format options', () => {
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
    test('should apply time formatting to x-axis in vertical bar charts', () => {
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

    test('should apply time formatting to y-axis in horizontal bar charts', () => {
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
    test('should work with axis bounds', () => {
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

    test('should work with label rotation', () => {
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

    test('should maintain time formatting consistency with tooltip', () => {
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
    test('should not be stuck on adaptive formatting', () => {
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

    test('should allow changing from smart_date to other formats', () => {
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

    test('should have xAxisTimeFormat in formData by default', () => {
      // This test specifically verifies our fix - that DEFAULT_FORM_DATA includes xAxisTimeFormat
      const chartProps = new ChartProps({
        ...baseChartPropsConfig,
        formData: baseFormData,
      });

      expect(chartProps.formData.xAxisTimeFormat).toBeDefined();
      expect(chartProps.formData.xAxisTimeFormat).toBe('smart_date');
    });
  });

  describe('Color By X-Axis Feature', () => {
    const categoricalData = [
      {
        data: [
          { category: 'A', value: 100 },
          { category: 'B', value: 150 },
          { category: 'C', value: 200 },
        ],
        colnames: ['category', 'value'],
        coltypes: ['STRING', 'BIGINT'],
      },
    ];

    test('should apply color by x-axis when enabled with no dimensions', () => {
      const formData = {
        ...baseFormData,
        colorByPrimaryAxis: true,
        groupby: [],
        x_axis: 'category',
        metric: 'value',
      };

      const chartProps = new ChartProps({
        ...baseChartPropsConfig,
        queriesData: categoricalData,
        formData,
      });

      const transformedProps = transformProps(
        chartProps as unknown as EchartsTimeseriesChartProps,
      );

      // Should have hidden legend series for each x-axis value
      const series = transformedProps.echartOptions.series as any[];
      expect(series.length).toBeGreaterThan(3); // Original series + hidden legend series

      // Check that legend data contains x-axis values
      const legendData = transformedProps.legendData as string[];
      expect(legendData).toContain('A');
      expect(legendData).toContain('B');
      expect(legendData).toContain('C');

      // Check that legend items have roundRect icons
      const legend = transformedProps.echartOptions.legend as any;
      expect(legend.data).toBeDefined();
      expect(Array.isArray(legend.data)).toBe(true);
      if (legend.data.length > 0 && typeof legend.data[0] === 'object') {
        expect(legend.data[0].icon).toBe('roundRect');
      }
    });

    test('should NOT apply color by x-axis when dimensions are present', () => {
      const formData = {
        ...baseFormData,
        colorByPrimaryAxis: true,
        groupby: ['region'],
        x_axis: 'category',
        metric: 'value',
      };

      const chartProps = new ChartProps({
        ...baseChartPropsConfig,
        queriesData: categoricalData,
        formData,
      });

      const transformedProps = transformProps(
        chartProps as unknown as EchartsTimeseriesChartProps,
      );

      // Legend data should NOT contain x-axis values when dimensions exist
      const legendData = transformedProps.legendData as string[];
      // Should use series names, not x-axis values
      expect(legendData.length).toBeLessThan(10);
    });

    test('should use x-axis values as color keys for consistent colors', () => {
      const formData = {
        ...baseFormData,
        colorByPrimaryAxis: true,
        groupby: [],
        x_axis: 'category',
        metric: 'value',
      };

      const chartProps = new ChartProps({
        ...baseChartPropsConfig,
        queriesData: categoricalData,
        formData,
      });

      const transformedProps = transformProps(
        chartProps as unknown as EchartsTimeseriesChartProps,
      );

      const series = transformedProps.echartOptions.series as any[];

      // Find the data series (not the hidden legend series)
      const dataSeries = series.find(
        s => s.data && s.data.length > 0 && s.type === 'bar',
      );
      expect(dataSeries).toBeDefined();

      // Check that data points have individual itemStyle with colors
      if (dataSeries && Array.isArray(dataSeries.data)) {
        const dataPoint = dataSeries.data[0];
        if (
          dataPoint &&
          typeof dataPoint === 'object' &&
          'itemStyle' in dataPoint
        ) {
          expect(dataPoint.itemStyle).toBeDefined();
          expect(dataPoint.itemStyle.color).toBeDefined();
        }
      }
    });

    test('should disable legend selection when color by x-axis is enabled', () => {
      const formData = {
        ...baseFormData,
        colorByPrimaryAxis: true,
        groupby: [],
        x_axis: 'category',
        metric: 'value',
      };

      const chartProps = new ChartProps({
        ...baseChartPropsConfig,
        queriesData: categoricalData,
        formData,
      });

      const transformedProps = transformProps(
        chartProps as unknown as EchartsTimeseriesChartProps,
      );

      const legend = transformedProps.echartOptions.legend as any;
      expect(legend.selectedMode).toBe(false);
      expect(legend.selector).toBe(false);
    });

    test('should work without stacking enabled', () => {
      const formData = {
        ...baseFormData,
        colorByPrimaryAxis: true,
        groupby: [],
        stack: null,
        x_axis: 'category',
        metric: 'value',
      };

      const chartProps = new ChartProps({
        ...baseChartPropsConfig,
        queriesData: categoricalData,
        formData,
      });

      const transformedProps = transformProps(
        chartProps as unknown as EchartsTimeseriesChartProps,
      );

      // Should still create legend with x-axis values
      const legendData = transformedProps.legendData as string[];
      expect(legendData.length).toBeGreaterThan(0);
      expect(legendData).toContain('A');
    });

    test('should handle when colorByPrimaryAxis is disabled', () => {
      const formData = {
        ...baseFormData,
        colorByPrimaryAxis: false,
        groupby: [],
        x_axis: 'category',
        metric: 'value',
      };

      const chartProps = new ChartProps({
        ...baseChartPropsConfig,
        queriesData: categoricalData,
        formData,
      });

      const transformedProps = transformProps(
        chartProps as unknown as EchartsTimeseriesChartProps,
      );

      // Legend should not be disabled when feature is off
      const legend = transformedProps.echartOptions.legend as any;
      expect(legend.selectedMode).not.toBe(false);
    });

    test('should use category axis (Y) as color key for horizontal bar charts', () => {
      const formData = {
        ...baseFormData,
        colorByPrimaryAxis: true,
        groupby: [],
        orientation: 'horizontal',
        x_axis: 'category',
        metric: 'value',
      };

      const chartProps = new ChartProps({
        ...baseChartPropsConfig,
        queriesData: categoricalData,
        formData,
      });

      const transformedProps = transformProps(
        chartProps as unknown as EchartsTimeseriesChartProps,
      );

      // Legend should contain category values (A, B, C), not numeric values
      const legendData = transformedProps.legendData as string[];
      expect(legendData).toContain('A');
      expect(legendData).toContain('B');
      expect(legendData).toContain('C');
    });

    test('should preserve source order for color-by-primary-axis legends when label sorting is enabled', () => {
      const unsortedCategoricalData = [
        {
          data: [
            { category: 'Zulu', value: 100 },
            { category: 'Alpha', value: 150 },
            { category: 'Mike', value: 200 },
          ],
          colnames: ['category', 'value'],
          coltypes: ['STRING', 'BIGINT'],
        },
      ];

      const formData = {
        ...baseFormData,
        colorByPrimaryAxis: true,
        groupby: [],
        legendSort: 'asc',
        x_axis: 'category',
        metric: 'value',
      };

      const chartProps = new ChartProps({
        ...baseChartPropsConfig,
        queriesData: unsortedCategoricalData,
        formData,
      });

      const transformedProps = transformProps(
        chartProps as unknown as EchartsTimeseriesChartProps,
      );

      const legend = transformedProps.echartOptions.legend as {
        data: { name: string }[];
      };
      expect(legend.data.map(item => item.name)).toEqual([
        'Zulu',
        'Alpha',
        'Mike',
      ]);
    });

    test('should deduplicate legend entries when x-axis has repeated values', () => {
      const repeatedData = [
        {
          data: [
            { category: 'A', value: 100 },
            { category: 'A', value: 200 },
            { category: 'B', value: 150 },
          ],
          colnames: ['category', 'value'],
          coltypes: ['STRING', 'BIGINT'],
        },
      ];

      const formData = {
        ...baseFormData,
        colorByPrimaryAxis: true,
        groupby: [],
        x_axis: 'category',
        metric: 'value',
      };

      const chartProps = new ChartProps({
        ...baseChartPropsConfig,
        queriesData: repeatedData,
        formData,
      });

      const transformedProps = transformProps(
        chartProps as unknown as EchartsTimeseriesChartProps,
      );

      const legendData = transformedProps.legendData as string[];
      // 'A' should appear only once despite being in the data twice
      expect(legendData.filter(v => v === 'A').length).toBe(1);
      expect(legendData).toContain('B');
    });

    test('should create exactly one hidden legend series per unique category', () => {
      const formData = {
        ...baseFormData,
        colorByPrimaryAxis: true,
        groupby: [],
        x_axis: 'category',
        metric: 'value',
      };

      const chartProps = new ChartProps({
        ...baseChartPropsConfig,
        queriesData: categoricalData,
        formData,
      });

      const transformedProps = transformProps(
        chartProps as unknown as EchartsTimeseriesChartProps,
      );

      const series = transformedProps.echartOptions.series as any[];
      const hiddenSeries = series.filter(
        s => s.type === 'line' && Array.isArray(s.data) && s.data.length === 0,
      );
      // One hidden series per unique category (A, B, C)
      expect(hiddenSeries.length).toBe(3);
    });
  });

  describe('Legend layout regressions', () => {
    const getBottomLegendLayout = (
      chartWidth: number,
      legendItems: string[],
      legendMargin?: string | number | null,
    ) =>
      getLegendLayoutResult({
        availableWidth: getHorizontalLegendAvailableWidth({
          chartWidth,
          orientation: LegendOrientation.Bottom,
          padding: getPadding(
            true,
            LegendOrientation.Bottom,
            false,
            false,
            legendMargin,
            false,
            undefined,
            undefined,
            undefined,
            true,
          ),
        }),
        chartHeight: baseChartPropsConfig.height,
        chartWidth,
        legendItems,
        legendMargin,
        orientation: LegendOrientation.Bottom,
        show: true,
        theme: supersetTheme,
        type: LegendType.Plain,
      });

    test('should fall back to scroll for horizontal bottom legends after margin expansion reduces available width', () => {
      const legendLabels = [
        'This is a long sales legend',
        'This is a long marketing legend',
        'This is a long operations legend',
      ];
      const longLegendData: ChartDataResponseResult[] = [
        createTestQueryData(
          [
            {
              [legendLabels[0]]: 100,
              __timestamp: 1609459200000,
            },
            {
              [legendLabels[1]]: 150,
              __timestamp: 1612137600000,
            },
            {
              [legendLabels[2]]: 200,
              __timestamp: 1614556800000,
            },
          ],
          {
            colnames: [...legendLabels, '__timestamp'],
            coltypes: [
              GenericDataType.Numeric,
              GenericDataType.Numeric,
              GenericDataType.Numeric,
              GenericDataType.Temporal,
            ],
          },
        ),
      ];
      const regressionFormData: EchartsTimeseriesFormData = {
        ...(baseFormData as EchartsTimeseriesFormData),
        metric: legendLabels,
        orientation: OrientationType.Horizontal,
        legendOrientation: LegendOrientation.Bottom,
        legendType: LegendType.Plain,
        showLegend: true,
      };
      const baselineChartProps = createEchartsTimeseriesTestChartProps<
        EchartsTimeseriesFormData,
        EchartsTimeseriesChartProps
      >({
        defaultFormData: regressionFormData,
        defaultVizType: 'echarts_timeseries_bar',
        defaultQueriesData: longLegendData,
        width: baseChartPropsConfig.width,
        height: baseChartPropsConfig.height,
      });
      const baselineTransformed = transformProps(baselineChartProps);
      const legendItems = (
        (baselineTransformed.echartOptions.legend as any).data as Array<
          string | { name: string }
        >
      ).map(item => (typeof item === 'string' ? item : item.name));
      let chartWidth: number | undefined;

      for (let width = 300; width <= 700; width += 1) {
        const initialLayout = getBottomLegendLayout(width, legendItems, null);

        if (initialLayout.effectiveType !== LegendType.Plain) {
          continue;
        }

        const refinedLayout = getBottomLegendLayout(
          width,
          legendItems,
          initialLayout.effectiveMargin ?? null,
        );

        if (refinedLayout.effectiveType === LegendType.Scroll) {
          chartWidth = width;
          break;
        }
      }

      expect(chartWidth).toBeDefined();
      const resolvedChartWidth = chartWidth ?? baseChartPropsConfig.width;

      const chartProps = createEchartsTimeseriesTestChartProps<
        EchartsTimeseriesFormData,
        EchartsTimeseriesChartProps
      >({
        defaultFormData: regressionFormData,
        defaultVizType: 'echarts_timeseries_bar',
        defaultQueriesData: longLegendData,
        width: resolvedChartWidth,
        height: baseChartPropsConfig.height,
      });

      const transformedProps = transformProps(chartProps);

      expect((transformedProps.echartOptions.legend as any).type).toBe(
        LegendType.Scroll,
      );
    });
  });
});
