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

import {
  SuperChart,
  VizType,
  getChartTransformPropsRegistry,
} from '@superset-ui/core';
import {
  EchartsRadarChartPlugin,
  RadarTransformProps,
} from '@superset-ui/plugin-chart-echarts';
import { withResizableChartDemo } from '@storybook-shared';
import { basic } from './data';

new EchartsRadarChartPlugin().configure({ key: VizType.Radar }).register();

getChartTransformPropsRegistry().registerValue(
  VizType.Radar,
  RadarTransformProps,
);

export default {
  title: 'Chart Plugins/plugin-chart-echarts/Radar',
  decorators: [withResizableChartDemo],
  args: {
    colorScheme: 'supersetColors',
    showLegend: true,
    isCircle: false,
    labelType: 'key',
    showLabels: true,
    numberFormat: 'SMART_NUMBER',
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
    showLegend: { control: 'boolean' },
    isCircle: {
      control: 'boolean',
      description: 'If true, radar shape is circle; otherwise polygon',
    },
    labelType: {
      control: 'select',
      options: ['key', 'value', 'percent', 'key_value', 'key_percent'],
    },
    showLabels: { control: 'boolean' },
    numberFormat: {
      control: 'select',
      options: ['SMART_NUMBER', '.2f', '.0%', '$,.2f', '.3s'],
    },
  },
};

export const Radar = ({
  width,
  height,
  colorScheme,
  showLegend,
  isCircle,
  labelType,
  showLabels,
  numberFormat,
}: {
  width: number;
  height: number;
  colorScheme: string;
  showLegend: boolean;
  isCircle: boolean;
  labelType: string;
  showLabels: boolean;
  numberFormat: string;
}) => (
  <SuperChart
    chartType={VizType.Radar}
    width={width}
    height={height}
    queriesData={[{ data: basic }]}
    formData={{
      columns: [],
      groupby: ['Sales'],
      metrics: [
        'Sales',
        'Administration',
        'Information Technology',
        'Customer Support',
        'Development',
        'Marketing',
      ],
      column_config: {
        Sales: { radarMetricMaxValue: 6500 },
        Administration: { radarMetricMaxValue: 16000 },
        'Information Technology': { radarMetricMaxValue: 30000 },
        'Customer Support': { radarMetricMaxValue: 38000 },
        Development: { radarMetricMaxValue: 52000 },
        Marketing: { radarMetricMaxValue: 25000 },
      },
      color_scheme: colorScheme,
      show_legend: showLegend,
      is_circle: isCircle,
      label_type: labelType,
      show_labels: showLabels,
      number_format: numberFormat,
    }}
  />
);
