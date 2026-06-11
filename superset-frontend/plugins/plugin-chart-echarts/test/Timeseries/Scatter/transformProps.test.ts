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

import { ChartProps, SMART_DATE_ID } from '@superset-ui/core';
import transformProps from '../../../src/Timeseries/transformProps';
import { DEFAULT_FORM_DATA } from '../../../src/Timeseries/constants';
import {
  EchartsTimeseriesSeriesType,
  EchartsTimeseriesFormData,
  EchartsTimeseriesChartProps,
} from '../../../src/Timeseries/types';
import { GenericDataType } from '@apache-superset/core/common';
import {
  D3_FORMAT_OPTIONS,
  D3_TIME_FORMAT_OPTIONS,
} from '@superset-ui/chart-controls';
import { supersetTheme } from '@apache-superset/core/theme';

describe('Scatter Chart X-axis Time Formatting', () => {
  const baseFormData: EchartsTimeseriesFormData = {
    ...DEFAULT_FORM_DATA,
    colorScheme: 'supersetColors',
    datasource: '1__table',
    granularity_sqla: '__timestamp',
    metric: ['column 1'],
    groupby: [],
    viz_type: 'echarts_timeseries_scatter',
    seriesType: EchartsTimeseriesSeriesType.Scatter,
  };

  const timeseriesData = [
    {
      data: [
        { column_1: 0.72099, __timestamp: 1609459200000 },
        { column_1: 0.77954, __timestamp: 1612137600000 },
        { column_1: 2.83434, __timestamp: 1614556800000 },
      ],
      colnames: ['column_1', '__timestamp'],
      coltypes: [GenericDataType.Numeric, GenericDataType.Temporal],
    },
  ];

  const baseChartPropsConfig = {
    width: 800,
    height: 600,
    queriesData: timeseriesData,
    theme: supersetTheme,
  };

  test('xAxisTimeFormat has no default formatter', () => {
    const chartProps = new ChartProps({
      ...baseChartPropsConfig,
      formData: baseFormData,
    });

    const transformedProps = transformProps(
      chartProps as EchartsTimeseriesChartProps,
    );

    expect(transformedProps.echartOptions.xAxis).toHaveProperty('axisLabel');
    const xAxis = transformedProps.echartOptions.xAxis as any;
    expect(xAxis.axisLabel).toHaveProperty('formatter');
    expect(typeof xAxis.axisLabel.formatter).toBe('function');
  });

  test.each(D3_TIME_FORMAT_OPTIONS.map(([id]) => id))(
    'should handle %s format',
    format => {
      const chartProps = new ChartProps({
        ...baseChartPropsConfig,
        formData: {
          ...baseFormData,
          xAxisTimeFormat: format,
        },
      });

      const transformedProps = transformProps(
        chartProps as EchartsTimeseriesChartProps,
      );

      const xAxis = transformedProps.echartOptions.xAxis as any;
      expect(xAxis.axisLabel).toHaveProperty('formatter');
      expect(typeof xAxis.axisLabel.formatter).toBe('function');
      if (format !== SMART_DATE_ID) {
        expect(xAxis.axisLabel.formatter.id).toBe(format);
      }
    },
  );
});

describe('Scatter Chart X-axis Number Formatting', () => {
  const baseFormData: EchartsTimeseriesFormData = {
    ...DEFAULT_FORM_DATA,
    colorScheme: 'supersetColors',
    datasource: '1__table',
    metric: ['column_1'],
    x_axis: 'column_2',
    groupby: [],
    viz_type: 'echarts_timeseries_scatter',
    seriesType: EchartsTimeseriesSeriesType.Scatter,
  };

  const timeseriesData = [
    {
      data: [
        { column_1: 0.72099, column_2: 3.01699 },
        { column_1: 0.77954, column_2: 3.44802 },
        { column_1: 2.83434, column_2: 3.58095 },
      ],
      colnames: ['column_1', 'column_2'],
      coltypes: [GenericDataType.Numeric, GenericDataType.Numeric],
    },
  ];

  const baseChartPropsConfig = {
    width: 800,
    height: 600,
    queriesData: timeseriesData,
    theme: supersetTheme,
  };

  test('should use SMART_NUMBER as default xAxisNumberFormat', () => {
    const chartProps = new ChartProps({
      ...baseChartPropsConfig,
      formData: baseFormData,
    });

    const transformedProps = transformProps(
      chartProps as EchartsTimeseriesChartProps,
    );

    expect(transformedProps.echartOptions.xAxis).toHaveProperty('axisLabel');
    const xAxis = transformedProps.echartOptions.xAxis as any;
    expect(xAxis.axisLabel).toHaveProperty('formatter');
    expect(typeof xAxis.axisLabel.formatter).toBe('function');
    expect(xAxis.axisLabel.formatter.id).toBe('SMART_NUMBER');
  });

  test.each(D3_FORMAT_OPTIONS.map(([id]) => id))(
    'should handle %s format',
    format => {
      const chartProps = new ChartProps({
        ...baseChartPropsConfig,
        formData: {
          ...baseFormData,
          xAxisNumberFormat: format,
        },
      });

      const transformedProps = transformProps(
        chartProps as EchartsTimeseriesChartProps,
      );

      expect(transformedProps.echartOptions.xAxis).toHaveProperty('axisLabel');
      const xAxis = transformedProps.echartOptions.xAxis as any;
      expect(xAxis.axisLabel).toHaveProperty('formatter');
      expect(typeof xAxis.axisLabel.formatter).toBe('function');
      expect(xAxis.axisLabel.formatter.id).toBe(format);
    },
  );
});

describe('Scatter Chart Orientation and Dot Size Metric', () => {
  const baseFormData: EchartsTimeseriesFormData = {
    ...DEFAULT_FORM_DATA,
    colorScheme: 'supersetColors',
    datasource: '1__table',
    metrics: ['sum_val'],
    x_axis: 'category_col',
    groupby: [],
    viz_type: 'echarts_timeseries_scatter',
    seriesType: EchartsTimeseriesSeriesType.Scatter,
  };

  const categoricalData = [
    {
      data: [
        { category_col: 'A', sum_val: 1, size_metric: 10 },
        { category_col: 'B', sum_val: 2, size_metric: 25 },
        { category_col: 'C', sum_val: 3, size_metric: 40 },
      ],
      colnames: ['category_col', 'sum_val', 'size_metric'],
      coltypes: [
        GenericDataType.String,
        GenericDataType.Numeric,
        GenericDataType.Numeric,
      ],
      label_map: {
        category_col: ['category_col'],
        sum_val: ['sum_val'],
        size_metric: ['size_metric'],
      },
    },
  ];

  const baseChartPropsConfig = {
    width: 800,
    height: 600,
    theme: supersetTheme,
  };

  const getScatterSeries = (props: ReturnType<typeof transformProps>) =>
    (props.echartOptions.series as any[]).filter(s => s.type === 'scatter');

  const singleMetricData = [
    {
      ...categoricalData[0],
      data: categoricalData[0].data.map(row => ({
        category_col: row.category_col,
        sum_val: row.sum_val,
      })),
      colnames: ['category_col', 'sum_val'],
      coltypes: [GenericDataType.String, GenericDataType.Numeric],
    },
  ];

  test('horizontal orientation swaps the dimension axis onto the y-axis', () => {
    const chartProps = new ChartProps({
      ...baseChartPropsConfig,
      queriesData: singleMetricData,
      formData: { ...baseFormData, orientation: 'horizontal' },
    });

    const transformedProps = transformProps(
      chartProps as EchartsTimeseriesChartProps,
    );
    const { xAxis, yAxis } = transformedProps.echartOptions as any;
    expect(yAxis.type).toBe('category');
    expect(xAxis.type).toBe('value');

    const series = getScatterSeries(transformedProps);
    expect(series).toHaveLength(1);
    // data points are flipped to [metric, dimension]
    expect(series[0].data[0]).toEqual([1, 'A']);
  });

  test('vertical orientation keeps the dimension axis on the x-axis', () => {
    const chartProps = new ChartProps({
      ...baseChartPropsConfig,
      queriesData: singleMetricData,
      formData: baseFormData,
    });

    const transformedProps = transformProps(
      chartProps as EchartsTimeseriesChartProps,
    );
    const { xAxis, yAxis } = transformedProps.echartOptions as any;
    expect(xAxis.type).toBe('category');
    expect(yAxis.type).toBe('value');

    const series = getScatterSeries(transformedProps);
    expect(series[0].data[0]).toEqual(['A', 1]);
  });

  test('size metric series is not rendered or shown in the legend', () => {
    const chartProps = new ChartProps({
      ...baseChartPropsConfig,
      queriesData: categoricalData,
      formData: { ...baseFormData, size: 'size_metric' },
    });

    const transformedProps = transformProps(
      chartProps as EchartsTimeseriesChartProps,
    );
    const series = getScatterSeries(transformedProps);
    expect(series).toHaveLength(1);
    expect(series[0].name).toBe('sum_val');
    expect(transformedProps.legendData).toEqual(['sum_val']);
  });

  test('size metric scales marker areas between min and max dot size', () => {
    const chartProps = new ChartProps({
      ...baseChartPropsConfig,
      queriesData: categoricalData,
      formData: {
        ...baseFormData,
        size: 'size_metric',
        minMarkerSize: 5,
        maxMarkerSize: 30,
      },
    });

    const transformedProps = transformProps(
      chartProps as EchartsTimeseriesChartProps,
    );
    const [series] = getScatterSeries(transformedProps);
    expect(typeof series.symbolSize).toBe('function');
    // smallest size value -> min dot size, largest -> max dot size
    expect(series.symbolSize(['A', 1])).toBe(5);
    expect(series.symbolSize(['C', 3])).toBe(30);
    // midpoint value -> midpoint *area*, not midpoint diameter
    expect(series.symbolSize(['B', 2]) ** 2).toBeCloseTo(
      (5 ** 2 + 30 ** 2) / 2,
    );
  });

  test('size metric lookups follow the dimension key when grouped', () => {
    const groupedData = [
      {
        data: [
          {
            category_col: 'A',
            'sum_val, g1': 1,
            'size_metric, g1': 10,
            'sum_val, g2': 2,
            'size_metric, g2': 40,
          },
        ],
        colnames: [
          'category_col',
          'sum_val, g1',
          'size_metric, g1',
          'sum_val, g2',
          'size_metric, g2',
        ],
        coltypes: [
          GenericDataType.String,
          GenericDataType.Numeric,
          GenericDataType.Numeric,
          GenericDataType.Numeric,
          GenericDataType.Numeric,
        ],
        label_map: {
          category_col: ['category_col'],
          'sum_val, g1': ['sum_val', 'g1'],
          'size_metric, g1': ['size_metric', 'g1'],
          'sum_val, g2': ['sum_val', 'g2'],
          'size_metric, g2': ['size_metric', 'g2'],
        },
      },
    ];
    const chartProps = new ChartProps({
      ...baseChartPropsConfig,
      queriesData: groupedData,
      formData: {
        ...baseFormData,
        groupby: ['group_col'],
        size: 'size_metric',
        minMarkerSize: 5,
        maxMarkerSize: 30,
      },
    });

    const transformedProps = transformProps(
      chartProps as EchartsTimeseriesChartProps,
    );
    const series = getScatterSeries(transformedProps);
    expect(series.map((s: any) => s.name).sort()).toEqual([
      'sum_val, g1',
      'sum_val, g2',
    ]);
    const g1 = series.find((s: any) => s.name === 'sum_val, g1');
    const g2 = series.find((s: any) => s.name === 'sum_val, g2');
    // the size extent is global: g1's point holds the minimum (10), g2's the
    // maximum (40)
    expect(g1.symbolSize(['A', 1])).toBe(5);
    expect(g2.symbolSize(['A', 2])).toBe(30);
  });

  test('horizontal orientation and size metric compose', () => {
    const chartProps = new ChartProps({
      ...baseChartPropsConfig,
      queriesData: categoricalData,
      formData: {
        ...baseFormData,
        orientation: 'horizontal',
        size: 'size_metric',
        minMarkerSize: 5,
        maxMarkerSize: 30,
      },
    });

    const transformedProps = transformProps(
      chartProps as EchartsTimeseriesChartProps,
    );
    const [series] = getScatterSeries(transformedProps);
    expect(series.data[0]).toEqual([1, 'A']);
    // with flipped data, the dimension value is at index 1
    expect(series.symbolSize([1, 'A'])).toBe(5);
    expect(series.symbolSize([3, 'C'])).toBe(30);
  });

  test('points without a size value fall back to the fixed marker size', () => {
    const chartProps = new ChartProps({
      ...baseChartPropsConfig,
      queriesData: [
        {
          ...categoricalData[0],
          data: [
            { category_col: 'A', sum_val: 1, size_metric: 10 },
            { category_col: 'B', sum_val: 2, size_metric: null },
            { category_col: 'C', sum_val: 3, size_metric: 40 },
          ],
        },
      ],
      formData: { ...baseFormData, size: 'size_metric', markerSize: 7 },
    });

    const transformedProps = transformProps(
      chartProps as EchartsTimeseriesChartProps,
    );
    const [series] = getScatterSeries(transformedProps);
    expect(series.symbolSize(['B', 2])).toBe(7);
  });

  test('size metric equal to the value metric sizes dots by their own value', () => {
    const dedupedData = [
      {
        data: [
          { category_col: 'A', sum_val: 1 },
          { category_col: 'B', sum_val: 2 },
          { category_col: 'C', sum_val: 3 },
        ],
        colnames: ['category_col', 'sum_val'],
        coltypes: [GenericDataType.String, GenericDataType.Numeric],
        label_map: {
          category_col: ['category_col'],
          sum_val: ['sum_val'],
        },
      },
    ];
    const chartProps = new ChartProps({
      ...baseChartPropsConfig,
      queriesData: dedupedData,
      formData: {
        ...baseFormData,
        size: 'sum_val',
        minMarkerSize: 5,
        maxMarkerSize: 30,
      },
    });

    const transformedProps = transformProps(
      chartProps as EchartsTimeseriesChartProps,
    );
    const series = getScatterSeries(transformedProps);
    expect(series).toHaveLength(1);
    expect(series[0].symbolSize(['A', 1])).toBe(5);
    expect(series[0].symbolSize(['C', 3])).toBe(30);
  });
});
