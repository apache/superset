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
  ChartProps,
  ChartPropsConfig,
  SqlaFormData,
  supersetTheme,
} from '@superset-ui/core';
import { EChartsOption } from 'echarts';
import transformProps from '../../src/Heatmap/transformProps';
import { HeatmapChartProps } from '../../src/Heatmap/types';

describe('Heatmap transformProps', () => {
  const defaultFormData = {
    datasource: '1__table',
    viz_type: 'heatmap_v2',
    x_axis: 'day',
    groupby: ['hour'],
    metric: 'count',
    sort_x_axis: 'alpha_asc',
    sort_y_axis: 'alpha_asc',
  } as SqlaFormData;

  const chartConfig: ChartPropsConfig = {
    formData: defaultFormData,
    height: 800,
    width: 800,
    queriesData: [
      {
        data: [
          { day: 'Monday', hour: '08', count: 10 },
          { day: 'Monday', hour: '09', count: 20 },
          { day: 'Tuesday', hour: '08', count: 15 },
          { day: 'Wednesday', hour: '09', count: 25 },
        ],
        colnames: ['day', 'hour', 'count'],
        coltypes: [0, 0, 2], // string, string, numeric
      },
    ],
    datasource: {
      datasource_type: 'table',
      description: 'test datasource',
      id: 1,
      columns: [],
      metrics: [],
      column_formats: {},
      currency_formats: {},
    },
    theme: supersetTheme,
  };

  it('should maintain proper axis order when data is missing', () => {
    const chartProps = new ChartProps(chartConfig);
    const transformedProps = transformProps(
      chartProps as unknown as HeatmapChartProps,
    );
    const echartOptions = transformedProps.echartOptions as EChartsOption;

    // Check that x-axis has all days in alphabetical order
    expect(echartOptions.xAxis).toEqual(
      expect.objectContaining({
        type: 'category',
        data: ['Monday', 'Tuesday', 'Wednesday'],
      }),
    );

    // Check that y-axis has all hours in alphabetical order
    expect(echartOptions.yAxis).toEqual(
      expect.objectContaining({
        type: 'category',
        data: ['08', '09'],
      }),
    );
  });

  it('should sort axes in descending order when configured', () => {
    const descFormData = {
      ...defaultFormData,
      sort_x_axis: 'alpha_desc',
      sort_y_axis: 'alpha_desc',
    };
    const chartProps = new ChartProps({
      ...chartConfig,
      formData: descFormData,
    });
    const transformedProps = transformProps(
      chartProps as unknown as HeatmapChartProps,
    );
    const echartOptions = transformedProps.echartOptions as EChartsOption;

    // Check descending alphabetical order
    expect(echartOptions.xAxis).toEqual(
      expect.objectContaining({
        type: 'category',
        data: ['Wednesday', 'Tuesday', 'Monday'],
      }),
    );

    expect(echartOptions.yAxis).toEqual(
      expect.objectContaining({
        type: 'category',
        data: ['09', '08'],
      }),
    );
  });

  it('should sort by metric value when configured', () => {
    const valueFormData = {
      ...defaultFormData,
      sort_x_axis: 'value_asc',
      sort_y_axis: 'value_desc',
    };
    const chartProps = new ChartProps({
      ...chartConfig,
      formData: valueFormData,
    });
    const transformedProps = transformProps(
      chartProps as unknown as HeatmapChartProps,
    );
    const echartOptions = transformedProps.echartOptions as EChartsOption;

    // Monday: 10+20=30, Tuesday: 15, Wednesday: 25
    // Ascending order by value: Tuesday(15), Wednesday(25), Monday(30)
    expect(echartOptions.xAxis).toEqual(
      expect.objectContaining({
        type: 'category',
        data: ['Tuesday', 'Wednesday', 'Monday'],
      }),
    );

    // Hour 08: 10+15=25, Hour 09: 20+25=45
    // Descending order by value: 09(45), 08(25)
    expect(echartOptions.yAxis).toEqual(
      expect.objectContaining({
        type: 'category',
        data: ['09', '08'],
      }),
    );
  });

  it('should handle numeric axis values properly', () => {
    const numericData = {
      ...chartConfig,
      queriesData: [
        {
          data: [
            { year: 2020, quarter: 1, sales: 100 },
            { year: 2021, quarter: 2, sales: 150 },
            { year: 2022, quarter: 1, sales: 200 },
            { year: 2021, quarter: 3, sales: 175 },
          ],
          colnames: ['year', 'quarter', 'sales'],
          coltypes: [2, 2, 2], // all numeric
        },
      ],
      formData: {
        ...defaultFormData,
        x_axis: 'year',
        groupby: ['quarter'],
        metric: 'sales',
      },
    };

    const chartProps = new ChartProps(numericData);
    const transformedProps = transformProps(
      chartProps as unknown as HeatmapChartProps,
    );
    const echartOptions = transformedProps.echartOptions as EChartsOption;

    // Numeric sorting should work correctly
    expect(echartOptions.xAxis).toEqual(
      expect.objectContaining({
        type: 'category',
        data: [2020, 2021, 2022],
      }),
    );

    expect(echartOptions.yAxis).toEqual(
      expect.objectContaining({
        type: 'category',
        data: [1, 2, 3],
      }),
    );
  });

  it('should preserve original order when no sorting is specified', () => {
    const noSortFormData = {
      ...defaultFormData,
      sort_x_axis: undefined,
      sort_y_axis: undefined,
    };
    const chartProps = new ChartProps({
      ...chartConfig,
      formData: noSortFormData,
    });
    const transformedProps = transformProps(
      chartProps as unknown as HeatmapChartProps,
    );
    const echartOptions = transformedProps.echartOptions as EChartsOption;

    // Should maintain the order as they appear in data
    expect(echartOptions.xAxis).toEqual(
      expect.objectContaining({
        type: 'category',
        data: ['Monday', 'Tuesday', 'Wednesday'],
      }),
    );

    expect(echartOptions.yAxis).toEqual(
      expect.objectContaining({
        type: 'category',
        data: ['08', '09'],
      }),
    );
  });

  it('should handle null/undefined values correctly', () => {
    const nullData = {
      ...chartConfig,
      queriesData: [
        {
          data: [
            { day: 'Monday', hour: '08', count: 10 },
            { day: null, hour: '09', count: 20 },
            { day: 'Tuesday', hour: null, count: 15 },
            { day: undefined, hour: '10', count: 25 },
          ],
          colnames: ['day', 'hour', 'count'],
          coltypes: [0, 0, 2],
        },
      ],
    };

    const chartProps = new ChartProps(nullData);
    const transformedProps = transformProps(
      chartProps as unknown as HeatmapChartProps,
    );
    const echartOptions = transformedProps.echartOptions as EChartsOption;

    // Null values should be converted to NULL_STRING
    expect(echartOptions.xAxis).toEqual(
      expect.objectContaining({
        type: 'category',
        data: expect.arrayContaining(['<NULL>', 'Monday', 'Tuesday']),
      }),
    );

    expect(echartOptions.yAxis).toEqual(
      expect.objectContaining({
        type: 'category',
        data: expect.arrayContaining(['<NULL>', '08', '09', '10']),
      }),
    );
  });
});
