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
import { ChartProps, supersetTheme } from '@superset-ui/core';
import { RadarSeriesOption } from 'echarts/charts';
import transformProps from '../../src/Radar/transformProps';
import {
  EchartsRadarChartProps,
  EchartsRadarFormData,
} from '../../src/Radar/types';

interface RadarIndicator {
  name: string;
  max: number;
  min: number;
}

type RadarShape = 'circle' | 'polygon';

interface RadarChartConfig {
  shape: RadarShape;
  indicator: RadarIndicator[];
}

interface RadarSeriesData {
  value: number[];
  name: string;
}

describe('Radar transformProps', () => {
  const formData: Partial<EchartsRadarFormData> = {
    colorScheme: 'supersetColors',
    datasource: '3__table',
    granularity_sqla: 'ds',
    columnConfig: {
      'MAX(na_sales)': {
        radarMetricMaxValue: null,
        radarMetricMinValue: 0,
      },
      'SUM(eu_sales)': {
        radarMetricMaxValue: 5000,
      },
    },
    groupby: [],
    metrics: [
      'MAX(na_sales)',
      'SUM(jp_sales)',
      'SUM(other_sales)',
      'SUM(eu_sales)',
    ],
    viz_type: 'radar',
    numberFormat: 'SMART_NUMBER',
    dateFormat: 'smart_date',
    showLegend: true,
    showLabels: true,
    isCircle: false,
  };

  const chartProps = new ChartProps({
    formData,
    width: 800,
    height: 600,
    queriesData: [
      {
        data: [
          {
            'MAX(na_sales)': 41.49,
            'SUM(jp_sales)': 1290.99,
            'SUM(other_sales)': 797.73,
            'SUM(eu_sales)': 2434.13,
          },
        ],
      },
    ],
    theme: supersetTheme,
  });

  it('should transform chart props for normalized radar chart & normalize all metrics except the ones with custom min & max', () => {
    const transformedProps = transformProps(
      chartProps as EchartsRadarChartProps,
    );
    const series = transformedProps.echartOptions.series as RadarSeriesOption[];
    const radar = transformedProps.echartOptions.radar as RadarChartConfig;

    expect((series[0].data as RadarSeriesData[])[0].value).toEqual([
      0.0170451044, 0.5303701939, 0.3277269497, 2434.13,
    ]);

    expect(radar.indicator).toEqual([
      {
        name: 'MAX(na_sales)',
        max: 1,
        min: 0,
      },
      {
        name: 'SUM(jp_sales)',
        max: 1,
        min: 0,
      },
      {
        name: 'SUM(other_sales)',
        max: 1,
        min: 0,
      },
      {
        name: 'SUM(eu_sales)',
        max: 5000,
        min: 0,
      },
    ]);
  });
});
