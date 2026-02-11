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
import { SuperChart, VizType } from '@superset-ui/core';
import { supersetTheme } from '@apache-superset/core/ui';
import { BigNumberTotalChartPlugin } from '@superset-ui/plugin-chart-echarts';
import { withResizableChartDemo } from '@storybook-shared';
import data from './data';

new BigNumberTotalChartPlugin()
  .configure({ key: 'big-number-total' })
  .register();

export default {
  title: 'Legacy Chart Plugins/legacy-preset-big-number/BigNumberTotal',
  decorators: [withResizableChartDemo],
  args: {
    subheader: 'total female participants',
    yAxisFormat: '.3s',
    forceTimestampFormatting: false,
  },
  argTypes: {
    subheader: { control: 'text' },
    yAxisFormat: {
      control: 'select',
      options: ['SMART_NUMBER', '.2f', '.0%', '$,.2f', '.3s', ',d'],
    },
    forceTimestampFormatting: { control: 'boolean' },
  },
};

export const TotalBasic = ({
  subheader,
  yAxisFormat,
  forceTimestampFormatting,
  width,
  height,
}: {
  subheader: string;
  yAxisFormat: string;
  forceTimestampFormatting: boolean;
  width: number;
  height: number;
}) => (
  <SuperChart
    theme={supersetTheme}
    chartType="big-number-total"
    width={width}
    height={height}
    queriesData={[{ data }]}
    formData={{
      metric: 'sum__num',
      subheader,
      viz_type: VizType.BigNumberTotal,
      y_axis_format: yAxisFormat,
      force_timestamp_formatting: forceTimestampFormatting,
    }}
  />
);

export const TotalNoData = ({
  width,
  height,
}: {
  width: number;
  height: number;
}) => (
  <SuperChart
    theme={supersetTheme}
    chartType="big-number-total"
    width={width}
    height={height}
    queriesData={[{ data: [] }]}
    formData={{
      metric: 'sum__num',
      subheader: 'total female participants',
      viz_type: VizType.BigNumberTotal,
      y_axis_format: '.3s',
    }}
  />
);
