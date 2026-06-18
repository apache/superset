/*
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

import { SuperChart, VizType } from '@superset-ui/core';
import { CompareChartPlugin } from '@superset-ui/legacy-preset-chart-nvd3';
import { dummyDatasource, withResizableChartDemo } from '@storybook-shared';
import data from './data';

new CompareChartPlugin().configure({ key: VizType.Compare }).register();

export default {
  title: 'Legacy Chart Plugins/legacy-preset-chart-nvd3/Compare',
  decorators: [withResizableChartDemo],
  args: {
    colorScheme: 'd3Category10',
    contribution: false,
    yLogScale: false,
  },
  argTypes: {
    colorScheme: {
      control: 'select',
      options: [
        'supersetColors',
        'd3Category10',
        'bnbColors',
        'googleCategory20c',
      ],
    },
    contribution: {
      control: 'boolean',
      description: 'Compute contribution to total',
    },
    yLogScale: { control: 'boolean' },
  },
};

export const Basic = ({
  colorScheme,
  contribution,
  yLogScale,
  width,
  height,
}: {
  colorScheme: string;
  contribution: boolean;
  yLogScale: boolean;
  width: number;
  height: number;
}) => (
  <SuperChart
    chartType="compare"
    width={width}
    height={height}
    datasource={dummyDatasource}
    queriesData={[{ data }]}
    formData={{
      bottom_margin: 'auto',
      color_scheme: colorScheme,
      contribution,
      left_margin: 'auto',
      viz_type: VizType.Compare,
      x_axis_format: 'smart_date',
      x_axis_label: '',
      x_axis_showminmax: false,
      x_ticks_layout: 'auto',
      y_axis_bounds: [null, null],
      y_axis_format: '.3s',
      y_axis_label: '',
      y_axis_showminmax: false,
      y_log_scale: yLogScale,
    }}
  />
);

/* eslint-disable no-magic-numbers */
const timeFormatData = [
  {
    key: ['Africa and Middle East'],
    values: [
      { x: 1606348800000, y: 3985 },
      { x: 1606435200000, y: 5882 },
      { x: 1606521600000, y: 7983 },
      { x: 1606608000000, y: 16462 },
      { x: 1606694400000, y: 5542 },
      { x: 1606780800000, y: 2825 },
    ],
  },
  {
    key: ['Asia'],
    values: [
      { x: 1606348800000, y: 34837 },
      { x: 1606435200000, y: 40718 },
      { x: 1606521600000, y: 58507 },
      { x: 1606608000000, y: 110120 },
      { x: 1606694400000, y: 43443 },
      { x: 1606780800000, y: 33538 },
    ],
  },
  {
    key: ['Australia'],
    values: [
      { x: 1606348800000, y: 12975 },
      { x: 1606435200000, y: 18471 },
      { x: 1606521600000, y: 17880 },
      { x: 1606608000000, y: 52204 },
      { x: 1606694400000, y: 26690 },
      { x: 1606780800000, y: 16423 },
    ],
  },
  {
    key: ['Europe'],
    values: [
      { x: 1606348800000, y: 127029 },
      { x: 1606435200000, y: 177637 },
      { x: 1606521600000, y: 172653 },
      { x: 1606608000000, y: 203654 },
      { x: 1606694400000, y: 79200 },
      { x: 1606780800000, y: 45238 },
    ],
  },
  {
    key: ['LatAm'],
    values: [
      { x: 1606348800000, y: 22513 },
      { x: 1606435200000, y: 24594 },
      { x: 1606521600000, y: 32578 },
      { x: 1606608000000, y: 34733 },
      { x: 1606694400000, y: 71696 },
      { x: 1606780800000, y: 166611 },
    ],
  },
  {
    key: ['North America'],
    values: [
      { x: 1606348800000, y: 104596 },
      { x: 1606435200000, y: 109850 },
      { x: 1606521600000, y: 136873 },
      { x: 1606608000000, y: 133243 },
      { x: 1606694400000, y: 327739 },
      { x: 1606780800000, y: 162711 },
    ],
  },
];

export const timeFormat = () => (
  <SuperChart
    chartType="compare"
    width={400}
    height={400}
    datasource={dummyDatasource}
    queriesData={[{ data: timeFormatData }]}
    formData={{
      datasource: '24771__table',
      vizType: VizType.Compare,
      urlParams: {},
      timeRangeEndpoints: ['inclusive', 'exclusive'],
      granularitySqla: '__time',
      timeGrainSqla: 'P1D',
      timeRange: 'Last week',
      metrics: ['random_metric'],
      adhocFilters: [],
      groupby: ['dim_origin_region'],
      timeseriesLimitMetric: null,
      orderDesc: true,
      contribution: false,
      rowLimit: 10000,
      colorScheme: 'd3Category10',
      labelColors: {},
      xAxisLabel: '',
      bottomMargin: 'auto',
      xTicksLayout: 'auto',
      xAxisFormat: 'smart_date',
      xAxisShowminmax: false,
      yAxisLabel: '',
      leftMargin: 'auto',
      yAxisShowminmax: false,
      yLogScale: false,
      yAxisFormat: 'SMART_NUMBER',
      yAxisBounds: [null, null],
      rollingType: 'None',
      comparisonType: 'values',
      resampleRule: null,
      resampleMethod: null,
      annotationLayers: [],
      appliedTimeExtras: {},
      where: '',
      having: '',
      havingFilters: [],
      filters: [],
    }}
  />
);
