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
} from '@superset-ui/core';
import transformProps, {
  getIntervalBoundsAndColors,
} from '../../src/Gauge/transformProps';
import { EchartsGaugeChartProps } from '../../src/Gauge/types';

describe('Echarts Gauge transformProps', () => {
  const baseFormData: SqlaFormData = {
    datasource: '26__table',
    viz_type: 'gauge_chart',
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
    expect(transformProps(chartProps as EchartsGaugeChartProps)).toEqual(
      expect.objectContaining({
        width: 800,
        height: 600,
        echartOptions: expect.objectContaining({
          series: expect.arrayContaining([
            expect.objectContaining({
              data: [
                {
                  value: 16595,
                  name: '',
                  itemStyle: {
                    color: '#1f77b4',
                  },
                  title: {
                    offsetCenter: ['0%', '20%'],
                    fontSize: 14,
                  },
                  detail: {
                    offsetCenter: ['0%', '32.6%'],
                    fontSize: 16.8,
                  },
                },
              ],
            }),
          ]),
        }),
      }),
    );
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
    expect(transformProps(chartProps as EchartsGaugeChartProps)).toEqual(
      expect.objectContaining({
        width: 800,
        height: 600,
        echartOptions: expect.objectContaining({
          series: expect.arrayContaining([
            expect.objectContaining({
              data: [
                {
                  value: 15,
                  name: 'year: 1988',
                  itemStyle: {
                    color: '#1f77b4',
                  },
                  title: {
                    offsetCenter: ['0%', '20%'],
                    fontSize: 14,
                  },
                  detail: {
                    offsetCenter: ['0%', '32.6%'],
                    fontSize: 16.8,
                  },
                },
                {
                  value: 219,
                  name: 'year: 1995',
                  itemStyle: {
                    color: '#ff7f0e',
                  },
                  title: {
                    offsetCenter: ['0%', '48%'],
                    fontSize: 14,
                  },
                  detail: {
                    offsetCenter: ['0%', '60.6%'],
                    fontSize: 16.8,
                  },
                },
              ],
            }),
          ]),
        }),
      }),
    );
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
    expect(transformProps(chartProps as EchartsGaugeChartProps)).toEqual(
      expect.objectContaining({
        width: 800,
        height: 600,
        echartOptions: expect.objectContaining({
          series: expect.arrayContaining([
            expect.objectContaining({
              data: [
                {
                  value: 140,
                  name: 'year: 2011, platform: PC',
                  itemStyle: {
                    color: '#1f77b4',
                  },
                  title: {
                    offsetCenter: ['0%', '20%'],
                    fontSize: 14,
                  },
                  detail: {
                    offsetCenter: ['0%', '32.6%'],
                    fontSize: 16.8,
                  },
                },
                {
                  value: 76,
                  name: 'year: 2008, platform: PC',
                  itemStyle: {
                    color: '#ff7f0e',
                  },
                  title: {
                    offsetCenter: ['0%', '48%'],
                    fontSize: 14,
                  },
                  detail: {
                    offsetCenter: ['0%', '60.6%'],
                    fontSize: 16.8,
                  },
                },
              ],
            }),
          ]),
        }),
      }),
    );
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
    expect(transformProps(chartProps as EchartsGaugeChartProps)).toEqual(
      expect.objectContaining({
        width: 800,
        height: 600,
        echartOptions: expect.objectContaining({
          series: expect.arrayContaining([
            expect.objectContaining({
              axisLine: {
                lineStyle: {
                  width: 14,
                  color: [
                    [0.5, '#1f77b4'],
                    [1, '#ff7f0e'],
                  ],
                },
                roundCap: false,
              },
              data: [
                {
                  value: 140,
                  name: 'year: 2011, platform: PC',
                  itemStyle: {
                    color: '#1f77b4',
                  },
                  title: {
                    offsetCenter: ['0%', '20%'],
                    fontSize: 14,
                  },
                  detail: {
                    offsetCenter: ['0%', '32.6%'],
                    fontSize: 16.8,
                  },
                },
                {
                  value: 76,
                  name: 'year: 2008, platform: PC',
                  itemStyle: {
                    color: '#ff7f0e',
                  },
                  title: {
                    offsetCenter: ['0%', '48%'],
                    fontSize: 14,
                  },
                  detail: {
                    offsetCenter: ['0%', '60.6%'],
                    fontSize: 16.8,
                  },
                },
              ],
            }),
          ]),
        }),
      }),
    );
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
