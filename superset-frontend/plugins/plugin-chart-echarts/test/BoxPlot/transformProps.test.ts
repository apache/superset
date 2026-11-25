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
import { supersetTheme } from '@apache-superset/core/theme';
import {
  DensityCurve,
  EchartsBoxPlotChartProps,
} from '../../src/BoxPlot/types';
import transformProps from '../../src/BoxPlot/transformProps';

interface QueryData {
  type: string;
  region: string;
  'AVG(averageprice)__mean': number;
  'AVG(averageprice)__median': number;
  'AVG(averageprice)__max': number;
  'AVG(averageprice)__min': number;
  'AVG(averageprice)__q1': number;
  'AVG(averageprice)__q3': number;
  'AVG(averageprice)__count': number;
  'AVG(averageprice)__outliers': number[];
  'AVG(averageprice)__density': DensityCurve;
}

interface QuerySeriesData {
  data: QueryData[];
}

const charlotteDensity: [number, number][] = [
  [1.4775, 0],
  [1.7, 0.45],
  [1.9025, 1],
  [2.2, 0.55],
  [2.735, 0.1],
];

const hartfordDensity: [number, number][] = [
  [1.862, 0],
  [2.1285, 0.4],
  [2.265, 0.35],
  [2.595, 0.1],
];

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

const buildChartPropsExt = (
  formDataOverrides: Partial<SqlaFormData> = {},
  queriesData?: QuerySeriesData[],
  filterState?: { selectedValues: string[] },
) =>
  new ChartProps({
    formData: { ...formData, ...formDataOverrides },
    width: 800,
    height: 600,
    queriesData,
    filterState,
    theme: supersetTheme,
  }) as unknown as EchartsBoxPlotChartProps;

const seriesWithDensity = (chartProps: ChartProps) =>
  (chartProps.queriesData[0].data as QueryData[]).map((row, i) => ({
    ...row,
    'AVG(averageprice)__density': i === 0 ? charlotteDensity : hartfordDensity,
  }));

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
  ] as QuerySeriesData[],
  theme: supersetTheme,
});

describe('BoxPlot transformProps', () => {
  const buildChartProps = (formDataOverrides: Partial<SqlaFormData> = {}) =>
    new ChartProps({
      formData: { ...formData, ...formDataOverrides },
      width: 800,
      height: 600,
      queriesData: chartProps.queriesData,
      theme: supersetTheme,
    }) as EchartsBoxPlotChartProps;

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

  test('should add a vertical Y-axis slider to dataZoom when yAxisSlider is enabled', () => {
    const { echartOptions } = transformProps(
      buildChartProps({ yAxisSlider: true }),
    );
    expect((echartOptions as any).dataZoom).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'slider',
          show: true,
          yAxisIndex: [0],
          filterMode: 'none',
        }),
      ]),
    );
  });

  test('should not add a Y-axis slider when yAxisSlider is disabled', () => {
    const { echartOptions } = transformProps(
      buildChartProps({ yAxisSlider: false }),
    );
    expect((echartOptions as any).dataZoom).not.toContainEqual(
      expect.objectContaining({ type: 'slider' }),
    );
  });

  test('should combine zoomable and yAxisSlider dataZoom entries', () => {
    const { echartOptions } = transformProps(
      buildChartProps({ zoomable: true, yAxisSlider: true }),
    );
    expect((echartOptions as any).dataZoom).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'inside' }),
        expect.objectContaining({ type: 'slider', yAxisIndex: [0] }),
      ]),
    );
  });

  test('box mode ignores __density', () => {
    const withoutDensity = transformProps(
      buildChartPropsExt(
        { distributionStyle: 'box' },
        chartProps.queriesData as QuerySeriesData[],
      ),
    );
    const withUnusedDensity = transformProps(
      buildChartPropsExt({ distributionStyle: 'box' }, [
        { data: seriesWithDensity(chartProps) },
      ]),
    );
    const withDensityEchartOptions = withUnusedDensity.echartOptions as any;
    const withoutDensityEchartOptions = withoutDensity.echartOptions as any;
    //assert that the relevant props will be the same
    expect(withDensityEchartOptions.series.map((s: any) => s.data)).toEqual(
      withoutDensityEchartOptions.series.map((s: any) => s.data),
    );
    expect(withDensityEchartOptions.series.map((s: any) => s.type)).toEqual(
      withoutDensityEchartOptions.series.map((s: any) => s.type),
    );
    expect(withDensityEchartOptions.xAxis.data).toEqual(
      withoutDensityEchartOptions.xAxis.data,
    );
    expect(withUnusedDensity.labelMap).toEqual(withoutDensity.labelMap);
  });

  test('missing distribution style defaults to box', () => {
    const plotProps = transformProps(
      buildChartPropsExt({}, [{ data: seriesWithDensity(chartProps) }]),
    );

    const { series } = plotProps.echartOptions as any;

    expect(series[0].name).toBe('boxplot');
    expect(series[0].type).toBe('boxplot');
  });
});

describe('ViolinPlot transformProps', () => {
  const mockApi = {
    value: jest.fn(() => 'organic, Charlotte'), //mock category name
    size: jest.fn(() => [10, 10]),
    coord: jest.fn((vals: [string, number]) => {
      const [, y] = vals;
      //mock that it returns 100 as cx, and multiple y by 10 to ensure in the test we get y*10
      return [100, y * 10];
    }),
  } as any;

  test('should return a violin plot when distribution style is specified as violin', () => {
    //create plot props with density metric in the query series and specifying the distribution style as violin
    const plotProps = transformProps(
      buildChartPropsExt({ distributionStyle: 'violin' }, [
        { data: seriesWithDensity(chartProps) },
      ]),
    );

    const { series } = plotProps.echartOptions as any;
    expect(series[0].name).toBe('violin');
    expect(series[0].type).toBe('custom');
  });

  test('violin mode shows inner box only when showInnerBox is true', () => {
    const distributionStyle = { distributionStyle: 'violin' } as const;
    const withInnerBox = transformProps(
      buildChartPropsExt({ ...distributionStyle, showInnerBox: true }, [
        { data: seriesWithDensity(chartProps) },
      ]),
    );
    const typesWithInnerBox = (withInnerBox.echartOptions as any).series.map(
      (s: any) => s.type,
    );
    expect(typesWithInnerBox).toContain('boxplot');

    const withoutInnerBox = transformProps(
      buildChartPropsExt({ ...distributionStyle, showInnerBox: false }, [
        { data: seriesWithDensity(chartProps) },
      ]),
    );
    const typesWithoutInnerBox = (
      withoutInnerBox.echartOptions as any
    ).series.map((s: any) => s.type);
    expect(typesWithoutInnerBox).not.toContain('boxplot');
  });

  test('violin with empty density curve renders nothing', () => {
    const plotProps = transformProps(
      buildChartPropsExt({ distributionStyle: 'violin' }, [
        {
          data: seriesWithDensity(chartProps).map((row, i) =>
            i === 0 ? { ...row, 'AVG(averageprice)__density': [] } : row,
          ),
        },
      ]),
    );
    const { series } = plotProps.echartOptions as any;
    const [seriesFirstIndex] = series;
    const { renderItem } = seriesFirstIndex;

    expect(renderItem({ dataIndex: 0 }, mockApi)).toBeNull();
    expect(renderItem({ dataIndex: 1 }, mockApi)).not.toBeNull();
  });

  test('single-point density renders a circle', () => {
    const plotProps = transformProps(
      buildChartPropsExt({ distributionStyle: 'violin' }, [
        {
          data: seriesWithDensity(chartProps).map((row, i) =>
            i === 0
              ? { ...row, 'AVG(averageprice)__density': [[1.4775, 0.2]] }
              : row,
          ),
        },
      ]),
    );

    const { series } = plotProps.echartOptions as any;
    const [seriesFirstIndex] = series;
    const { renderItem } = seriesFirstIndex;
    expect(renderItem({ dataIndex: 0 }, mockApi)).toEqual(
      expect.objectContaining({
        type: 'circle',
        shape: expect.objectContaining({
          cx: 100,
          cy: 14.775,
          r: 4,
        }),
      }),
    );
  });

  test('violin series enables clipping for y-axis zoom', () => {
    const plotProps = transformProps(
      buildChartPropsExt(
        { distributionStyle: 'violin', yAxisSlider: true, zoomable: true },
        [{ data: seriesWithDensity(chartProps) }],
      ),
    );
    const clipSettings = (plotProps.echartOptions as any).series.map(
      (s: any) => s.clip,
    );
    expect(clipSettings).toContain(true);
  });

  test('violin width stays bounded for different density magnitudes', () => {
    const scales = [0.5, 1, 1.5, 2, 3, 4, 5];

    scales.forEach(scale => {
      const plotProps = transformProps(
        buildChartPropsExt({ distributionStyle: 'violin' }, [
          {
            data: seriesWithDensity(chartProps).map(row => ({
              ...row,
              'AVG(averageprice)__density': charlotteDensity.map(
                ([value, density]) =>
                  [value, density * scale] as [number, number],
              ),
            })),
          },
        ]),
      );

      const { series } = plotProps.echartOptions as any;
      const [seriesFirstIndex] = series;
      const { renderItem } = seriesFirstIndex;
      const result = renderItem({ dataIndex: 0 }, mockApi);

      expect(result.type).toBe('polygon');

      const [bandwidth] = mockApi.size();
      const maxWidthOfTheBand = 0.4;
      const widthLimit = maxWidthOfTheBand * bandwidth;
      const cx = 100;

      const xValues = result.shape.points.map(([x]: number[]) => x);
      expect(Math.min(...xValues)).toBeGreaterThanOrEqual(cx - widthLimit);
      expect(Math.max(...xValues)).toBeLessThanOrEqual(cx + widthLimit);
    });
  });
});
