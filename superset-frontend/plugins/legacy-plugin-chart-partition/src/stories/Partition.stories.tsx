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
import PartitionChartPlugin from '@superset-ui/legacy-plugin-chart-partition';
import data from './data';
import { dummyDatasource, withResizableChartDemo } from '@storybook-shared';

new PartitionChartPlugin().configure({ key: VizType.Partition }).register();

export default {
  title: 'Legacy Chart Plugins/legacy-plugin-chart-partition',
  decorators: [withResizableChartDemo],
  args: {
    colorScheme: 'd3Category10',
    logScale: false,
    equalDateSize: true,
    richTooltip: true,
    partitionLimit: 5,
    partitionThreshold: 0.05,
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
    logScale: { control: 'boolean' },
    equalDateSize: { control: 'boolean' },
    richTooltip: { control: 'boolean' },
    partitionLimit: {
      control: { type: 'range', min: 1, max: 20, step: 1 },
      description: 'Maximum number of partitions to show',
    },
    partitionThreshold: {
      control: { type: 'range', min: 0, max: 0.5, step: 0.01 },
      description: 'Minimum threshold for partition size',
    },
  },
};

export const Basic = ({
  colorScheme,
  logScale,
  equalDateSize,
  richTooltip,
  partitionLimit,
  partitionThreshold,
  width,
  height,
}: {
  colorScheme: string;
  logScale: boolean;
  equalDateSize: boolean;
  richTooltip: boolean;
  partitionLimit: number;
  partitionThreshold: number;
  width: number;
  height: number;
}) => (
  <SuperChart
    theme={supersetTheme}
    chartType={VizType.Partition}
    width={width}
    height={height}
    datasource={dummyDatasource}
    queriesData={[{ data }]}
    formData={{
      color_scheme: colorScheme,
      date_time_format: '%Y-%m-%d',
      equal_date_size: equalDateSize,
      groupby: ['region', 'country_code'],
      log_scale: logScale,
      metrics: ['sum__SP_POP_TOTL'],
      number_format: '.3s',
      partition_limit: String(partitionLimit),
      partition_threshold: String(partitionThreshold),
      rich_tooltip: richTooltip,
      time_series_option: 'not-time',
    }}
  />
);
