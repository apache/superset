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

import { SuperChart } from '@superset-ui/core';
import CalendarChartPlugin from '@superset-ui/legacy-plugin-chart-calendar';
import data from './data';
import { dummyDatasource, withResizableChartDemo } from '@storybook-shared';

new CalendarChartPlugin().configure({ key: 'calendar' }).register();

export default {
  title: 'Legacy Chart Plugins/legacy-plugin-chart-calendar',
  decorators: [withResizableChartDemo],
  args: {
    cellSize: 10,
    cellPadding: 2,
    cellRadius: 0,
    domainGranularity: 'month',
    subdomainGranularity: 'day',
    linearColorScheme: 'schemeRdYlBu',
    steps: 10,
    showLegend: true,
    showValues: false,
    showMetricName: true,
  },
  argTypes: {
    cellSize: { control: { type: 'range', min: 5, max: 30, step: 1 } },
    cellPadding: { control: { type: 'range', min: 0, max: 10, step: 1 } },
    cellRadius: { control: { type: 'range', min: 0, max: 15, step: 1 } },
    domainGranularity: {
      control: 'select',
      options: ['week', 'month', 'year'],
      description:
        'Domain granularity must be larger than subdomain granularity',
    },
    subdomainGranularity: {
      control: 'select',
      options: ['day', 'week'],
      description: 'Subdomain granularity (must be smaller than domain)',
    },
    linearColorScheme: {
      control: 'select',
      options: [
        'schemeRdYlBu',
        'schemeBlues',
        'schemeGreens',
        'schemeOranges',
        'schemePurples',
        'schemeReds',
      ],
    },
    steps: { control: { type: 'range', min: 2, max: 20, step: 1 } },
    showLegend: { control: 'boolean' },
    showValues: { control: 'boolean' },
    showMetricName: { control: 'boolean' },
  },
};

export const Basic = ({
  cellSize,
  cellPadding,
  cellRadius,
  domainGranularity,
  subdomainGranularity,
  linearColorScheme,
  steps,
  showLegend,
  showValues,
  showMetricName,
  width,
  height,
}: {
  cellSize: number;
  cellPadding: number;
  cellRadius: number;
  domainGranularity: string;
  subdomainGranularity: string;
  linearColorScheme: string;
  steps: number;
  showLegend: boolean;
  showValues: boolean;
  showMetricName: boolean;
  width: number;
  height: number;
}) => (
  <SuperChart
    chartType="calendar"
    width={width}
    height={height}
    datasource={dummyDatasource}
    queriesData={[{ data }]}
    formData={{
      cell_size: cellSize,
      cell_padding: cellPadding,
      cell_radius: cellRadius,
      domain_granularity: domainGranularity,
      subdomain_granularity: subdomainGranularity,
      linear_color_scheme: linearColorScheme,
      steps,
      y_axis_format: '.3s',
      x_axis_time_format: 'smart_date',
      show_legend: showLegend,
      show_values: showValues,
      show_metric_name: showMetricName,
    }}
  />
);
