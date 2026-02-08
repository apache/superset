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
import { BubbleChartPlugin } from '@superset-ui/legacy-preset-chart-nvd3';
import { dummyDatasource, withResizableChartDemo } from '@storybook-shared';
import data from './data';

new BubbleChartPlugin().configure({ key: VizType.LegacyBubble }).register();

export default {
  title: 'Legacy Chart Plugins/legacy-preset-chart-nvd3/Bubble',
  decorators: [withResizableChartDemo],
  args: {
    colorScheme: 'd3Category10',
    maxBubbleSize: 50,
    showLegend: true,
    xLogScale: false,
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
    maxBubbleSize: {
      control: { type: 'range', min: 10, max: 100, step: 5 },
    },
    showLegend: { control: 'boolean' },
    xLogScale: { control: 'boolean' },
    yLogScale: { control: 'boolean' },
  },
};

export const Basic = ({
  colorScheme,
  maxBubbleSize,
  showLegend,
  xLogScale,
  yLogScale,
  width,
  height,
}: {
  colorScheme: string;
  maxBubbleSize: number;
  showLegend: boolean;
  xLogScale: boolean;
  yLogScale: boolean;
  width: number;
  height: number;
}) => (
  <SuperChart
    chartType={VizType.LegacyBubble}
    width={width}
    height={height}
    datasource={dummyDatasource}
    queriesData={[{ data }]}
    formData={{
      annotation_data: {},
      bottom_margin: 'auto',
      color_scheme: colorScheme,
      entity: 'country_name',
      left_margin: 'auto',
      max_bubble_size: String(maxBubbleSize),
      series: 'region',
      show_legend: showLegend,
      size: 'sum__SP_POP_TOTL',
      viz_type: VizType.LegacyBubble,
      x: 'sum__SP_RUR_TOTL_ZS',
      x_axis_format: '.3s',
      x_axis_label: 'Rural Population %',
      x_axis_showminmax: false,
      x_log_scale: xLogScale,
      x_ticks_layout: 'auto',
      y: 'sum__SP_DYN_LE00_IN',
      y_axis_format: '.3s',
      y_axis_label: 'Life Expectancy',
      y_axis_showminmax: false,
      y_log_scale: yLogScale,
    }}
  />
);
