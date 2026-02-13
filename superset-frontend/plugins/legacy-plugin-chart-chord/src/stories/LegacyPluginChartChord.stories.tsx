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
import { supersetTheme } from '@apache-superset/core/ui';
import ChordChartPlugin from '@superset-ui/legacy-plugin-chart-chord';
import data from './data';
import { withResizableChartDemo } from '@storybook-shared';

new ChordChartPlugin().configure({ key: VizType.Chord }).register();

export default {
  title: 'Legacy Chart Plugins/legacy-plugin-chart-chord',
  decorators: [withResizableChartDemo],
  args: {
    colorScheme: 'd3Category10',
    yAxisFormat: '.2f',
    sortByMetric: true,
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
    yAxisFormat: {
      control: 'select',
      options: ['SMART_NUMBER', '.2f', '.0%', '$,.2f', '.3s', ',d'],
    },
    sortByMetric: {
      control: 'boolean',
      description: 'Sort arcs by metric value',
    },
  },
};

export const Basic = ({
  width,
  height,
  colorScheme,
  yAxisFormat,
  sortByMetric,
}: {
  width: number;
  height: number;
  colorScheme: string;
  yAxisFormat: string;
  sortByMetric: boolean;
}) => (
  <SuperChart
    theme={supersetTheme}
    chartType={VizType.Chord}
    width={width}
    height={height}
    queriesData={[{ data }]}
    formData={{
      color_scheme: colorScheme,
      y_axis_format: yAxisFormat,
      sort_by_metric: sortByMetric,
    }}
  />
);
