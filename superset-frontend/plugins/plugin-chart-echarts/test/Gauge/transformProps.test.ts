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
  CategoricalColorNamespace,
  ChartProps,
  SqlaFormData,
  supersetTheme,
  VizType,
} from '@superset-ui/core';
import transformProps, {
  getIntervalBoundsAndColors,
} from '../../src/Gauge/transformProps';
import { EchartsGaugeChartProps } from '../../src/Gauge/types';

describe('Echarts Gauge transformProps', () => {
  const baseFormData: SqlaFormData = {
    datasource: '26__table',
    viz_type: VizType.Gauge,
    metric: 'count',
    adhocFilters: [],
    rowLimit: 10,
    minVal: 0,
    maxVal: 100,
    startAngle: 225,
    endAngle: -45,
    colorScheme: 'SUPERSET_DEFAULT',
    fontSize: 14,
    numberFormat: 'SMART_NUMBER',
    valueFormatter: '{value}',
    showPointer: true,
    animation: true,
    showAxisTick: false,
    showSplitLine: false,
    splitNumber: 10,
    showProgress: true,
    overlap: true,
    roundCap: false,
  };

  it('should transform chart props for no group by column', () => {
    const formData: SqlaFormData = { ...baseFormData, groupby: [] };
    const queriesData = [
      {
        colnames: ['count'],
        data: [
          {
            count: 16595,
          },
        ],
      },
    ];

    const chartPropsConfig = {
      formData,
      width: 800,
      height: 600,
      queriesData,
      theme: supersetTheme,
    };

    const chartProps = new ChartProps(chartPropsConfig);
    const result = transformProps(chartProps as EchartsGaugeChartProps);

    // Test core properties
    expect(result.width).toBe(800);
    expect(result.height).toBe(600);

    // Test series data
    const seriesData = (result.echartOptions as any).series[0].data;
    expect(seriesData).toHaveLength(1);
    expect(seriesData[0].value).toBe(16595);
    expect(seriesData[0].name).toBe('');
    expect(seriesData[0].itemStyle.color).toBe('#1f77b4');

    // Test detail and title positions
    expect(seriesData[0].title.offsetCenter).toEqual(['0%', '20%']);
    expect(seriesData[0].title.fontSize).toBe(14);
    expect(seriesData[0].detail.offsetCenter).toEqual(['0%', '32.6%']);
    expect(seriesData[0].detail.fontSize).toBe(16.8);
  });

  it('should transform chart props for single group by column', () => {
    const formData: SqlaFormData = {
      ...baseFormData,
      groupby: ['year'],
    };
    const queriesData = [
      {
        colnames: ['year', 'count'],
        data: [
          {
            year: 1988,
            count: 15,
          },
          {
            year: 1995,
            count: 219,
          },
        ],
      },
    ];

    const chartPropsConfig = {
      formData,
      width: 800,
      height: 600,
      queriesData,
      theme: supersetTheme,
    };

    const chartProps = new ChartProps(chartPropsConfig);
    const result = transformProps(chartProps as EchartsGaugeChartProps);

    // Test core properties
    expect(result.width).toBe(800);
    expect(result.height).toBe(600);

    // Test series data
    const seriesData = (result.echartOptions as any).series[0].data;
    expect(seriesData).toHaveLength(2);

    // First data point
    expect(seriesData[0].value).toBe(15);
    expect(seriesData[0].name).toBe('year: 1988');
    expect(seriesData[0].itemStyle.color).toBe('#1f77b4');
    expect(seriesData[0].title.offsetCenter).toEqual(['0%', '20%']);
    expect(seriesData[0].title.fontSize).toBe(14);
    expect(seriesData[0].detail.offsetCenter).toEqual(['0%', '32.6%']);
    expect(seriesData[0].detail.fontSize).toBe(16.8);

    // Second data point
    expect(seriesData[1].value).toBe(219);
    expect(seriesData[1].name).toBe('year: 1995');
    expect(seriesData[1].itemStyle.color).toBe('#ff7f0e');
    expect(seriesData[1].title.offsetCenter).toEqual(['0%', '48%']);
    expect(seriesData[1].title.fontSize).toBe(14);
    expect(seriesData[1].detail.offsetCenter).toEqual(['0%', '60.6%']);
    expect(seriesData[1].detail.fontSize).toBe(16.8);
  });

  it('should transform chart props for multiple group by columns', () => {
    const formData: SqlaFormData = {
      ...baseFormData,
      groupby: ['year', 'platform'],
    };
    const queriesData = [
      {
        colnames: ['year', 'platform', 'count'],
        data: [
          {
            year: 2011,
            platform: 'PC',
            count: 140,
          },
          {
            year: 2008,
            platform: 'PC',
            count: 76,
          },
        ],
      },
    ];

    const chartPropsConfig = {
      formData,
      width: 800,
      height: 600,
      queriesData,
      theme: supersetTheme,
    };

    const chartProps = new ChartProps(chartPropsConfig);
    const result = transformProps(chartProps as EchartsGaugeChartProps);

    // Test core properties
    expect(result.width).toBe(800);
    expect(result.height).toBe(600);

    // Test series data
    const seriesData = (result.echartOptions as any).series[0].data;
    expect(seriesData).toHaveLength(2);

    // First data point
    expect(seriesData[0].value).toBe(140);
    expect(seriesData[0].name).toBe('year: 2011, platform: PC');
    expect(seriesData[0].itemStyle.color).toBe('#1f77b4');
    expect(seriesData[0].title.offsetCenter).toEqual(['0%', '20%']);
    expect(seriesData[0].title.fontSize).toBe(14);
    expect(seriesData[0].detail.offsetCenter).toEqual(['0%', '32.6%']);
    expect(seriesData[0].detail.fontSize).toBe(16.8);

    // Second data point
    expect(seriesData[1].value).toBe(76);
    expect(seriesData[1].name).toBe('year: 2008, platform: PC');
    expect(seriesData[1].itemStyle.color).toBe('#ff7f0e');
    expect(seriesData[1].title.offsetCenter).toEqual(['0%', '48%']);
    expect(seriesData[1].title.fontSize).toBe(14);
    expect(seriesData[1].detail.offsetCenter).toEqual(['0%', '60.6%']);
    expect(seriesData[1].detail.fontSize).toBe(16.8);
  });

  it('should transform chart props for intervals', () => {
    const formData: SqlaFormData = {
      ...baseFormData,
      groupby: ['year', 'platform'],
      intervals: '60,100',
      intervalColorIndices: '1,2',
      minVal: 20,
    };
    const queriesData = [
      {
        colnames: ['year', 'platform', 'count'],
        data: [
          {
            year: 2011,
            platform: 'PC',
            count: 140,
          },
          {
            year: 2008,
            platform: 'PC',
            count: 76,
          },
        ],
      },
    ];

    const chartPropsConfig = {
      formData,
      width: 800,
      height: 600,
      queriesData,
      theme: supersetTheme,
    };

    const chartProps = new ChartProps(chartPropsConfig);
    const result = transformProps(chartProps as EchartsGaugeChartProps);

    // Test core properties
    expect(result.width).toBe(800);
    expect(result.height).toBe(600);

    // Test axisLine intervals
    const { axisLine } = (result.echartOptions as any).series[0];
    expect(axisLine.roundCap).toBe(false);
    expect(axisLine.lineStyle.width).toBe(14);
    expect(axisLine.lineStyle.color).toEqual([
      [0.5, '#1f77b4'],
      [1, '#ff7f0e'],
    ]);

    // Test series data
    const seriesData = (result.echartOptions.series as any)[0].data;
    expect(seriesData).toHaveLength(2);

    // First data point
    expect(seriesData[0].value).toBe(140);
    expect(seriesData[0].name).toBe('year: 2011, platform: PC');
    expect(seriesData[0].itemStyle.color).toBe('#1f77b4');

    // Second data point
    expect(seriesData[1].value).toBe(76);
    expect(seriesData[1].name).toBe('year: 2008, platform: PC');
    expect(seriesData[1].itemStyle.color).toBe('#ff7f0e');
  });
});

describe('getIntervalBoundsAndColors', () => {
  it('should generate correct interval bounds and colors', () => {
    const colorFn = CategoricalColorNamespace.getScale(
      'supersetColors' as string,
    );
    expect(getIntervalBoundsAndColors('', '', colorFn, 0, 10)).toEqual([]);
    expect(getIntervalBoundsAndColors('4, 10', '1, 2', colorFn, 0, 10)).toEqual(
      [
        [0.4, '#1f77b4'],
        [1, '#ff7f0e'],
      ],
    );
    expect(
      getIntervalBoundsAndColors('4, 8, 10', '9, 8, 7', colorFn, 0, 10),
    ).toEqual([
      [0.4, '#bcbd22'],
      [0.8, '#7f7f7f'],
      [1, '#e377c2'],
    ]);
    expect(getIntervalBoundsAndColors('4, 10', '1, 2', colorFn, 2, 10)).toEqual(
      [
        [0.25, '#1f77b4'],
        [1, '#ff7f0e'],
      ],
    );
    expect(
      getIntervalBoundsAndColors('-4, 0', '1, 2', colorFn, -10, 0),
    ).toEqual([
      [0.6, '#1f77b4'],
      [1, '#ff7f0e'],
    ]);
    expect(
      getIntervalBoundsAndColors('-4, -2', '1, 2', colorFn, -10, -2),
    ).toEqual([
      [0.75, '#1f77b4'],
      [1, '#ff7f0e'],
    ]);
  });
});
