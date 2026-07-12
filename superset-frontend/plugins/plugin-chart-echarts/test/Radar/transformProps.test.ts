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
import { supersetTheme } from '@apache-superset/core/theme';
import { RadarSeriesOption } from 'echarts/charts';
import transformProps from '../../src/Radar/transformProps';
import {
  EchartsRadarChartProps,
  EchartsRadarFormData,
} from '../../src/Radar/types';
import { LegendOrientation } from '../../src/types';

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
  label?: {
    formatter: (params: {
      name: string;
      value: number | null;
      dimensionIndex: number;
    }) => string;
  };
}

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

const queriesData = [
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
];

const chartProps = new ChartProps({
  formData,
  width: 800,
  height: 600,
  queriesData,
  theme: supersetTheme,
});

describe('Radar transformProps', () => {
  test('should transform chart props for normalized radar chart & normalize all metrics except the ones with custom min & max', () => {
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

describe('legend sorting', () => {
  const legendSortData = [
    {
      data: [
        {
          name: 'Sylvester sales',
          'SUM(jp_sales)': 1290.99,
          'SUM(other_sales)': 797.73,
          'SUM(eu_sales)': 2434.13,
        },
        {
          name: 'Arnold sales',
          'SUM(jp_sales)': 290.99,
          'SUM(other_sales)': 627.73,
          'SUM(eu_sales)': 434.13,
        },
        {
          name: 'Mark sales',
          'SUM(jp_sales)': 2290.99,
          'SUM(other_sales)': 1297.73,
          'SUM(eu_sales)': 934.13,
        },
      ],
    },
  ];
  const createChartProps = (overrides = {}) =>
    new ChartProps({
      ...chartProps,
      formData: {
        ...formData,
        groupby: ['name'],
        metrics: ['SUM(jp_sales)', 'SUM(other_sales)', 'SUM(eu_sales)'],
        ...overrides,
      },
      queriesData: legendSortData,
    });

  test('preserves original data order when no sort specified', () => {
    const props = createChartProps({ legendSort: null });
    const result = transformProps(props as EchartsRadarChartProps);

    const legendData = (result.echartOptions.legend as any).data;
    expect(legendData).toEqual([
      'Sylvester sales',
      'Arnold sales',
      'Mark sales',
    ]);
  });

  test('sorts alphabetically ascending when legendSort is "asc"', () => {
    const props = createChartProps({ legendSort: 'asc' });
    const result = transformProps(props as EchartsRadarChartProps);

    const legendData = (result.echartOptions.legend as any).data;
    expect(legendData).toEqual([
      'Arnold sales',
      'Mark sales',
      'Sylvester sales',
    ]);
  });

  test('sorts alphabetically descending when legendSort is "desc"', () => {
    const props = createChartProps({ legendSort: 'desc' });
    const result = transformProps(props as EchartsRadarChartProps);

    const legendData = (result.echartOptions.legend as any).data;
    expect(legendData).toEqual([
      'Sylvester sales',
      'Mark sales',
      'Arnold sales',
    ]);
  });
});

// Regression for #30270: "Wrong visualization of missing values in radar
// charts". A null metric value must NOT be transformed into 0. In
// `normalizeArray`, `null / max` coerces the null to 0, so a missing data
// point ends up plotted at the center of the radar as if it were a real
// zero, instead of being left out (a gap). This test feeds a datum with a
// null metric and asserts the null is preserved in the normalized series
// value rather than silently becoming 0.
const missingValueData = [
  {
    data: [
      {
        name: 'Series A',
        'SUM(jp_sales)': 10,
        'SUM(other_sales)': null,
        'SUM(eu_sales)': 30,
      },
    ],
  },
];

const missingValueProps = new ChartProps({
  formData: {
    ...formData,
    // No columnConfig custom bounds so every metric is normalized.
    columnConfig: {},
    groupby: ['name'],
    metrics: ['SUM(jp_sales)', 'SUM(other_sales)', 'SUM(eu_sales)'],
  },
  width: 800,
  height: 600,
  queriesData: missingValueData,
  theme: supersetTheme,
});

test('preserves a null metric instead of plotting it as 0', () => {
  const result = transformProps(missingValueProps as EchartsRadarChartProps);
  const series = result.echartOptions.series as RadarSeriesOption[];
  const value = (series[0].data as RadarSeriesData[])[0].value as (
    number | null
  )[];

  // Index 1 corresponds to 'SUM(other_sales)', which was null in the datum.
  // The correct behavior is to keep the gap (null/undefined) so ECharts does
  // not draw a point at the center. On master this is 0, so this fails.
  expect(value[1]).not.toBe(0);
  expect(value[1] == null).toBe(true);
});

test('label formatter renders a missing metric as blank instead of NaN', () => {
  const result = transformProps(missingValueProps as EchartsRadarChartProps);
  const series = result.echartOptions.series as RadarSeriesOption[];
  const seriesData = (series[0].data as RadarSeriesData[])[0];
  const { label } = seriesData;
  if (!label) throw new Error('expected series data to have a label config');

  // Index 1 corresponds to 'SUM(other_sales)', which is null. Denormalizing
  // it must not fall through to `Number('null')` (NaN) in the label text.
  const formatted = label.formatter({
    name: 'Series A',
    value: null,
    dimensionIndex: 1,
  });

  expect(formatted).not.toContain('NaN');
});

describe('radar center positioning', () => {
  const getCenter = (overrides: Partial<EchartsRadarFormData> = {}) => {
    const props = new ChartProps({
      formData: {
        ...formData,
        showLegend: true,
        legendMargin: 100,
        ...overrides,
      },
      width: 800,
      height: 600,
      queriesData,
      theme: supersetTheme,
    });
    const result = transformProps(props as EchartsRadarChartProps);
    const { center } = result.echartOptions.radar as {
      center: [string, string];
    };
    return {
      x: parseFloat(center[0]),
      y: parseFloat(center[1]),
    };
  };

  test('keeps the center when the legend is hidden', () => {
    const { x, y } = getCenter({ showLegend: false });
    expect(x).toBe(50);
    expect(y).toBe(50);
  });

  test('shifts the center right (away from the legend) when legend is on the left', () => {
    const { x, y } = getCenter({ legendOrientation: LegendOrientation.Left });
    expect(x).toBeGreaterThan(50);
    expect(y).toBe(50);
  });

  test('shifts the center left (away from the legend) when legend is on the right', () => {
    const { x, y } = getCenter({ legendOrientation: LegendOrientation.Right });
    expect(x).toBeLessThan(50);
    expect(y).toBe(50);
  });

  test('shifts the center down (away from the legend) when legend is on the top', () => {
    const { x, y } = getCenter({ legendOrientation: LegendOrientation.Top });
    expect(x).toBe(50);
    expect(y).toBeGreaterThan(50);
  });

  test('shifts the center up (away from the legend) when legend is on the bottom', () => {
    const { x, y } = getCenter({ legendOrientation: LegendOrientation.Bottom });
    expect(x).toBe(50);
    expect(y).toBeLessThan(50);
  });
});
