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
import { ChartProps, VizType } from '@superset-ui/core';
import { supersetTheme } from '@apache-superset/core/ui';
import {
  LegendOrientation,
  LegendType,
  EchartsTimeseriesSeriesType,
} from '../../src';
import transformProps from '../../src/MixedTimeseries/transformProps';
import {
  EchartsMixedTimeseriesFormData,
  EchartsMixedTimeseriesProps,
} from '../../src/MixedTimeseries/types';

const formData: EchartsMixedTimeseriesFormData = {
  annotationLayers: [],
  area: false,
  areaB: false,
  legendMargin: null,
  logAxis: false,
  logAxisSecondary: false,
  markerEnabled: false,
  markerEnabledB: false,
  markerSize: 0,
  markerSizeB: 0,
  minorSplitLine: false,
  minorTicks: false,
  opacity: 0,
  opacityB: 0,
  orderDesc: false,
  orderDescB: false,
  richTooltip: false,
  rowLimit: 0,
  rowLimitB: 0,
  legendOrientation: LegendOrientation.Top,
  legendType: LegendType.Scroll,
  showLegend: false,
  showValue: false,
  showValueB: false,
  stack: true,
  stackB: true,
  truncateYAxis: false,
  truncateYAxisSecondary: false,
  xAxisLabelRotation: 0,
  xAxisTitle: '',
  xAxisTitleMargin: 0,
  yAxisBounds: [undefined, undefined],
  yAxisBoundsSecondary: [undefined, undefined],
  yAxisTitle: '',
  yAxisTitleMargin: 0,
  yAxisTitlePosition: '',
  yAxisTitleSecondary: '',
  zoomable: false,
  colorScheme: 'bnbColors',
  datasource: '3__table',
  x_axis: 'ds',
  metrics: ['sum__num'],
  metricsB: ['sum__num'],
  groupby: ['gender'],
  groupbyB: ['gender'],
  seriesType: EchartsTimeseriesSeriesType.Line,
  seriesTypeB: EchartsTimeseriesSeriesType.Bar,
  viz_type: VizType.MixedTimeseries,
  forecastEnabled: false,
  forecastPeriods: [],
  forecastInterval: 0,
  forecastSeasonalityDaily: 0,
  legendSort: null,
};

const queriesData = [
  {
    data: [
      { boy: 1, girl: 2, ds: 599616000000 },
      { boy: 3, girl: 4, ds: 599916000000 },
    ],
    label_map: {
      ds: ['ds'],
      boy: ['boy'],
      girl: ['girl'],
    },
  },
  {
    data: [
      { boy: 1, girl: 2, ds: 599616000000 },
      { boy: 3, girl: 4, ds: 599916000000 },
    ],
    label_map: {
      ds: ['ds'],
      boy: ['boy'],
      girl: ['girl'],
    },
  },
];

const chartPropsConfig = {
  formData,
  width: 800,
  height: 600,
  queriesData,
  theme: supersetTheme,
};

test('should transform chart props for viz with showQueryIdentifiers=false', () => {
  const chartPropsConfigWithoutIdentifiers = {
    ...chartPropsConfig,
    formData: {
      ...formData,
      showQueryIdentifiers: false,
    },
  };
  const chartProps = new ChartProps(chartPropsConfigWithoutIdentifiers);
  const transformed = transformProps(chartProps as EchartsMixedTimeseriesProps);

  // Check that series IDs don't include query identifiers
  const seriesIds = (transformed.echartOptions.series as any[]).map(
    (s: any) => s.id,
  );
  expect(seriesIds).toContain('sum__num, girl');
  expect(seriesIds).toContain('sum__num, boy');
  expect(seriesIds).not.toContain('sum__num (Query A), girl');
  expect(seriesIds).not.toContain('sum__num (Query A), boy');
  expect(seriesIds).not.toContain('sum__num (Query B), girl');
  expect(seriesIds).not.toContain('sum__num (Query B), boy');

  // Check that series name include query identifiers
  const seriesName = (transformed.echartOptions.series as any[]).map(
    (s: any) => s.name,
  );
  expect(seriesName).toContain('sum__num, girl');
  expect(seriesName).toContain('sum__num, boy');
  expect(seriesName).not.toContain('sum__num (Query A), girl');
  expect(seriesName).not.toContain('sum__num (Query A), boy');
  expect(seriesName).not.toContain('sum__num (Query B), girl');
  expect(seriesName).not.toContain('sum__num (Query B), boy');

  expect((transformed.echartOptions.legend as any).data).toEqual([
    'sum__num, girl',
    'sum__num, boy',
    'sum__num, girl',
    'sum__num, boy',
  ]);
});

test('should transform chart props for viz with showQueryIdentifiers=true', () => {
  const chartPropsConfigWithIdentifiers = {
    ...chartPropsConfig,
    formData: {
      ...formData,
      showQueryIdentifiers: true,
    },
  };
  const chartProps = new ChartProps(chartPropsConfigWithIdentifiers);
  const transformed = transformProps(chartProps as EchartsMixedTimeseriesProps);

  // Check that series IDs include query identifiers
  const seriesIds = (transformed.echartOptions.series as any[]).map(
    (s: any) => s.id,
  );
  expect(seriesIds).toContain('sum__num (Query A), girl');
  expect(seriesIds).toContain('sum__num (Query A), boy');
  expect(seriesIds).toContain('sum__num (Query B), girl');
  expect(seriesIds).toContain('sum__num (Query B), boy');
  expect(seriesIds).not.toContain('sum__num, girl');
  expect(seriesIds).not.toContain('sum__num, boy');

  // Check that series name include query identifiers
  const seriesName = (transformed.echartOptions.series as any[]).map(
    (s: any) => s.name,
  );
  expect(seriesName).toContain('sum__num (Query A), girl');
  expect(seriesName).toContain('sum__num (Query A), boy');
  expect(seriesName).toContain('sum__num (Query B), girl');
  expect(seriesName).toContain('sum__num (Query B), boy');
  expect(seriesName).not.toContain('sum__num, girl');
  expect(seriesName).not.toContain('sum__num, boy');

  expect((transformed.echartOptions.legend as any).data).toEqual([
    'sum__num (Query A), girl',
    'sum__num (Query A), boy',
    'sum__num (Query B), girl',
    'sum__num (Query B), boy',
  ]);
});

describe('legend sorting', () => {
  const getChartProps = (overrides = {}) =>
    new ChartProps({
      ...chartPropsConfig,
      formData: {
        ...formData,
        ...overrides,
        showQueryIdentifiers: true,
      },
    });

  it('sort legend by data', () => {
    const chartProps = getChartProps({
      legendSort: null,
    });
    const transformed = transformProps(
      chartProps as EchartsMixedTimeseriesProps,
    );

    expect((transformed.echartOptions.legend as any).data).toEqual([
      'sum__num (Query A), girl',
      'sum__num (Query A), boy',
      'sum__num (Query B), girl',
      'sum__num (Query B), boy',
    ]);
  });

  it('sort legend by label ascending', () => {
    const chartProps = getChartProps({
      legendSort: 'asc',
    });
    const transformed = transformProps(
      chartProps as EchartsMixedTimeseriesProps,
    );

    expect((transformed.echartOptions.legend as any).data).toEqual([
      'sum__num (Query A), boy',
      'sum__num (Query A), girl',
      'sum__num (Query B), boy',
      'sum__num (Query B), girl',
    ]);
  });

  it('sort legend by label descending', () => {
    const chartProps = getChartProps({
      legendSort: 'desc',
    });
    const transformed = transformProps(
      chartProps as EchartsMixedTimeseriesProps,
    );

    expect((transformed.echartOptions.legend as any).data).toEqual([
      'sum__num (Query B), girl',
      'sum__num (Query B), boy',
      'sum__num (Query A), girl',
      'sum__num (Query A), boy',
    ]);
  });
});

test('legend margin: top orientation sets grid.top correctly', () => {
  const chartPropsConfigWithoutIdentifiers = {
    ...chartPropsConfig,
    formData: {
      ...formData,
      legendMargin: 250,
      showLegend: true,
    },
  };
  const chartProps = new ChartProps(chartPropsConfigWithoutIdentifiers);
  const transformed = transformProps(chartProps as EchartsMixedTimeseriesProps);

  expect((transformed.echartOptions.grid as any).top).toEqual(270);
});

test('legend margin: bottom orientation sets grid.bottom correctly', () => {
  const chartPropsConfigWithoutIdentifiers = {
    ...chartPropsConfig,
    formData: {
      ...formData,
      legendMargin: 250,
      showLegend: true,
      legendOrientation: LegendOrientation.Bottom,
    },
  };
  const chartProps = new ChartProps(chartPropsConfigWithoutIdentifiers);
  const transformed = transformProps(chartProps as EchartsMixedTimeseriesProps);

  expect((transformed.echartOptions.grid as any).bottom).toEqual(270);
});

test('legend margin: left orientation sets grid.left correctly', () => {
  const chartPropsConfigWithoutIdentifiers = {
    ...chartPropsConfig,
    formData: {
      ...formData,
      legendMargin: 250,
      showLegend: true,
      legendOrientation: LegendOrientation.Left,
    },
  };
  const chartProps = new ChartProps(chartPropsConfigWithoutIdentifiers);
  const transformed = transformProps(chartProps as EchartsMixedTimeseriesProps);

  expect((transformed.echartOptions.grid as any).left).toEqual(270);
});

test('legend margin: right orientation sets grid.right correctly', () => {
  const chartPropsConfigWithoutIdentifiers = {
    ...chartPropsConfig,
    formData: {
      ...formData,
      legendMargin: 270,
      showLegend: true,
      legendOrientation: LegendOrientation.Right,
    },
  };
  const chartProps = new ChartProps(chartPropsConfigWithoutIdentifiers);
  const transformed = transformProps(chartProps as EchartsMixedTimeseriesProps);

  expect((transformed.echartOptions.grid as any).right).toEqual(270);
});

test('should correctly calculate stackGroup for multi-groupby scenarios', () => {
  const formDataWithMultiGroupby: EchartsMixedTimeseriesFormData = {
    ...formData,
    groupby: ['city', 'gender'],
    groupbyB: ['city', 'gender'],
  };
  const queriesDataWithMultiGroupby = [
    {
      data: [
        { city: 'SF', gender: 'boy', num: 1, ds: 599616000000 },
        { city: 'SF', gender: 'girl', num: 2, ds: 599616000000 },
      ],
      label_map: {
        ds: ['ds'],
        'SF, boy': ['SF', 'boy'],
        'SF, girl': ['SF', 'girl'],
      },
    },
    {
      data: [
        { city: 'SF', gender: 'boy', num: 1, ds: 599616000000 },
        { city: 'SF', gender: 'girl', num: 2, ds: 599616000000 },
      ],
      label_map: {
        ds: ['ds'],
        'SF, boy': ['SF', 'boy'],
        'SF, girl': ['SF', 'girl'],
      },
    },
  ];
  const chartProps = new ChartProps({
    ...chartPropsConfig,
    formData: formDataWithMultiGroupby,
    queriesData: queriesDataWithMultiGroupby,
  });
  const transformed = transformProps(chartProps as EchartsMixedTimeseriesProps);

  const series = transformed.echartOptions.series as any[];
  // SF should be the stackGroup for both boy and girl in Query A
  expect(series[0].stack).toEqual('SF\na');
  expect(series[1].stack).toEqual('SF\na');

  // SF should be the stackGroup for both boy and girl in Query B
  expect(series[2].stack).toEqual('SF\nb');
  expect(series[3].stack).toEqual('SF\nb');
});

test('should fallback to entryName splitting when label_map is missing', () => {
  const formDataWithMultiGroupby: EchartsMixedTimeseriesFormData = {
    ...formData,
    groupby: ['city', 'gender'],
  };
  const queriesDataWithoutLabelMap = [
    {
      data: [{ 'SF, boy': 1, ds: 599616000000 }],
      // label_map missing for SF, boy
      label_map: { ds: ['ds'] },
    },
    queriesData[1],
  ];
  const chartProps = new ChartProps({
    ...chartPropsConfig,
    formData: formDataWithMultiGroupby,
    queriesData: queriesDataWithoutLabelMap,
  });
  const transformed = transformProps(chartProps as EchartsMixedTimeseriesProps);
  const series = transformed.echartOptions.series as any[];
  // Should still be SF because it split 'SF, boy'
  expect(series[0].stack).toEqual('SF\na');
});

test('should handle commas in dimension values correctly when using label_map', () => {
  const queriesDataWithCommas = [
    {
      data: [{ 'City, with comma, boy': 1, ds: 599616000000 }],
      label_map: {
        ds: ['ds'],
        'City, with comma, boy': ['City, with comma', 'boy'],
      },
    },
    queriesData[1],
  ];
  const chartProps = new ChartProps({
    ...chartPropsConfig,
    formData: { ...formData, groupby: ['city', 'gender'] },
    queriesData: queriesDataWithCommas,
  });
  const transformed = transformProps(chartProps as EchartsMixedTimeseriesProps);
  const series = transformed.echartOptions.series as any[];
  // Should be 'City, with comma' because it used label_map[0]
  expect(series[0].stack).toEqual('City, with comma\na');
});

test('should NOT set stackGroup when groupby length is 1', () => {
  const chartProps = new ChartProps({
    ...chartPropsConfig,
    formData: { ...formData, groupby: ['gender'] },
  });
  const transformed = transformProps(chartProps as EchartsMixedTimeseriesProps);
  const series = transformed.echartOptions.series as any[];
  // When groupby length is 1, stackGroup is undefined, so it uses name + suffix
  expect(series[0].stack).toEqual('sum__num, boy\na');
});
