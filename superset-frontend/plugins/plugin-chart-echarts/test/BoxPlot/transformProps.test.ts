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
import { ChartProps, SqlaFormData } from '@superset-ui/core';
import { supersetTheme } from '@apache-superset/core/ui';
import { EchartsBoxPlotChartProps } from '../../src/BoxPlot/types';
import transformProps from '../../src/BoxPlot/transformProps';

describe('BoxPlot transformProps', () => {
  const formData: SqlaFormData = {
    datasource: '5__table',
    granularity_sqla: 'ds',
    time_grain_sqla: 'P1Y',
    columns: [],
    metrics: ['AVG(averageprice)'],
    groupby: ['type', 'region'],
    whiskerOptions: 'Tukey',
    yAxisFormat: 'SMART_NUMBER',
    viz_type: 'my_chart',
    zoomable: true,
  };
  const chartProps = new ChartProps({
    formData,
    width: 800,
    height: 600,
    queriesData: [
      {
        data: [
          {
            type: 'organic',
            region: 'Charlotte',
            'AVG(averageprice)__mean': 1.9405512820512825,
            'AVG(averageprice)__median': 1.9025,
            'AVG(averageprice)__max': 2.505,
            'AVG(averageprice)__min': 1.4775,
            'AVG(averageprice)__q1': 1.73875,
            'AVG(averageprice)__q3': 2.105,
            'AVG(averageprice)__count': 39,
            'AVG(averageprice)__outliers': [2.735],
          },
          {
            type: 'organic',
            region: 'Hartford Springfield',
            'AVG(averageprice)__mean': 2.231141025641026,
            'AVG(averageprice)__median': 2.265,
            'AVG(averageprice)__max': 2.595,
            'AVG(averageprice)__min': 1.862,
            'AVG(averageprice)__q1': 2.1285,
            'AVG(averageprice)__q3': 2.32625,
            'AVG(averageprice)__count': 39,
            'AVG(averageprice)__outliers': [],
          },
        ],
      },
    ],
    theme: supersetTheme,
  });

  test('should use localized metric labels in category names', () => {
    const adhocMetric = {
      expressionType: 'SIMPLE' as const,
      column: { column_name: 'averageprice' },
      aggregate: 'AVG',
      label: 'AVG(averageprice)',
      translations: { label: { de: 'Durchschnittspreis' } },
    };
    const adhocMetric2 = {
      expressionType: 'SIMPLE' as const,
      column: { column_name: 'volume' },
      aggregate: 'SUM',
      label: 'SUM(volume)',
      translations: { label: { de: 'Gesamtvolumen' } },
    };
    const localizedChartProps = new ChartProps({
      formData: {
        ...formData,
        metrics: [adhocMetric, adhocMetric2],
      },
      width: 800,
      height: 600,
      queriesData: [
        {
          data: [
            {
              type: 'organic',
              region: 'Charlotte',
              'AVG(averageprice)__mean': 1.94,
              'AVG(averageprice)__median': 1.9,
              'AVG(averageprice)__max': 2.5,
              'AVG(averageprice)__min': 1.47,
              'AVG(averageprice)__q1': 1.73,
              'AVG(averageprice)__q3': 2.1,
              'AVG(averageprice)__count': 39,
              'AVG(averageprice)__outliers': [],
              'SUM(volume)__mean': 100,
              'SUM(volume)__median': 90,
              'SUM(volume)__max': 200,
              'SUM(volume)__min': 50,
              'SUM(volume)__q1': 70,
              'SUM(volume)__q3': 130,
              'SUM(volume)__count': 39,
              'SUM(volume)__outliers': [],
            },
          ],
        },
      ],
      theme: supersetTheme,
      locale: 'de',
    });
    const transformed = transformProps(
      localizedChartProps as EchartsBoxPlotChartProps,
    );
    const xAxisData = (transformed.echartOptions.xAxis as any).data;
    expect(xAxisData).toContain('organic, Charlotte, Durchschnittspreis');
    expect(xAxisData).toContain('organic, Charlotte, Gesamtvolumen');
  });

  test('should use localized axis titles when translations and locale are provided', () => {
    const localizedChartProps = new ChartProps({
      formData: {
        ...formData,
        xAxisTitle: 'Revenue',
        yAxisTitle: 'Price',
        translations: {
          x_axis_title: { de: 'Umsatz' },
          y_axis_title: { de: 'Preis' },
        },
      },
      width: 800,
      height: 600,
      queriesData: [{ data: [] }],
      theme: supersetTheme,
      locale: 'de',
    });
    const transformed = transformProps(
      localizedChartProps as EchartsBoxPlotChartProps,
    );
    const xAxis = transformed.echartOptions.xAxis as { name?: string };
    const yAxis = transformed.echartOptions.yAxis as { name?: string };
    expect(xAxis.name).toBe('Umsatz');
    expect(yAxis.name).toBe('Preis');
  });

  test('should use original axis titles when no locale is provided', () => {
    const localizedChartProps = new ChartProps({
      formData: {
        ...formData,
        xAxisTitle: 'Revenue',
        yAxisTitle: 'Price',
        translations: {
          x_axis_title: { de: 'Umsatz' },
          y_axis_title: { de: 'Preis' },
        },
      },
      width: 800,
      height: 600,
      queriesData: [{ data: [] }],
      theme: supersetTheme,
    });
    const transformed = transformProps(
      localizedChartProps as EchartsBoxPlotChartProps,
    );
    const xAxis = transformed.echartOptions.xAxis as { name?: string };
    const yAxis = transformed.echartOptions.yAxis as { name?: string };
    expect(xAxis.name).toBe('Revenue');
    expect(yAxis.name).toBe('Price');
  });

  test('should fall back to original axis titles when locale has no matching translation', () => {
    const localizedChartProps = new ChartProps({
      formData: {
        ...formData,
        xAxisTitle: 'Revenue',
        yAxisTitle: 'Price',
        translations: {
          x_axis_title: { de: 'Umsatz' },
        },
      },
      width: 800,
      height: 600,
      queriesData: [{ data: [] }],
      theme: supersetTheme,
      locale: 'ja',
    });
    const transformed = transformProps(
      localizedChartProps as EchartsBoxPlotChartProps,
    );
    const xAxis = transformed.echartOptions.xAxis as { name?: string };
    const yAxis = transformed.echartOptions.yAxis as { name?: string };
    expect(xAxis.name).toBe('Revenue');
    expect(yAxis.name).toBe('Price');
  });

  test('should fall back to base language when regional locale has no match', () => {
    const localizedChartProps = new ChartProps({
      formData: {
        ...formData,
        xAxisTitle: 'Revenue',
        translations: {
          x_axis_title: { de: 'Umsatz' },
        },
      },
      width: 800,
      height: 600,
      queriesData: [{ data: [] }],
      theme: supersetTheme,
      locale: 'de-AT',
    });
    const transformed = transformProps(
      localizedChartProps as EchartsBoxPlotChartProps,
    );
    const xAxis = transformed.echartOptions.xAxis as { name?: string };
    expect(xAxis.name).toBe('Umsatz');
  });

  test('should transform chart props for viz', () => {
    expect(transformProps(chartProps as EchartsBoxPlotChartProps)).toEqual(
      expect.objectContaining({
        width: 800,
        height: 600,
        echartOptions: expect.objectContaining({
          dataZoom: expect.arrayContaining([
            {
              moveOnMouseWheel: true,
              type: 'inside',
              zoomOnMouseWheel: false,
            },
          ]),
          series: expect.arrayContaining([
            expect.objectContaining({
              name: 'boxplot',
              data: expect.arrayContaining([
                expect.objectContaining({
                  name: 'organic, Charlotte',
                  value: [
                    1.4775,
                    1.73875,
                    1.9025,
                    2.105,
                    2.505,
                    1.9405512820512825,
                    39,
                    [2.735],
                  ],
                }),
                expect.objectContaining({
                  name: 'organic, Hartford Springfield',
                  value: [
                    1.862,
                    2.1285,
                    2.265,
                    2.32625,
                    2.595,
                    2.231141025641026,
                    39,
                    [],
                  ],
                }),
              ]),
            }),
            expect.objectContaining({
              name: 'outlier',
              data: [['organic, Charlotte', 2.735]],
            }),
          ]),
        }),
      }),
    );
  });
});
