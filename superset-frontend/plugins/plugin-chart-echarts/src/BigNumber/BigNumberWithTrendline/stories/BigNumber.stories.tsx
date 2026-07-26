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
import { BigNumberChartPlugin } from '@superset-ui/plugin-chart-echarts';
import { withResizableChartDemo } from '@storybook-shared';
import testData from './data';

new BigNumberChartPlugin().configure({ key: 'big-number' }).register();

const TIME_COLUMN = '__timestamp';

const formData = {
  color_picker: {
    r: 0,
    g: 122,
    b: 135,
    a: 1,
  },
  compare_lag: 1,
  compare_suffix: 'over 10Y',
  metric: 'sum__SP_POP_TOTL',
  show_trend_line: true,
  start_y_axis_at_zero: true,
  time_grain_sqla: 'P1Y',
  viz_type: VizType.BigNumber,
  x_axis: TIME_COLUMN,
  y_axis_format: '.3s',
};

/**
 * Add null values to trendline data
 * @param data input data
 */
function withNulls(origData: object[], nullPosition = 3) {
  const data = [...origData];
  data[nullPosition] = {
    ...data[nullPosition],
    sum__SP_POP_TOTL: null,
  };
  return data;
}

export default {
  title: 'Legacy Chart Plugins/legacy-preset-big-number/BigNumberWithTrendline',
  decorators: [withResizableChartDemo],
  args: {
    showTrendLine: true,
    startYAxisAtZero: true,
    compareLag: 1,
    compareSuffix: 'over 10Y',
    yAxisFormat: '.3s',
  },
  argTypes: {
    showTrendLine: { control: 'boolean' },
    startYAxisAtZero: { control: 'boolean' },
    compareLag: {
      control: { type: 'range', min: 0, max: 10, step: 1 },
      description: 'Number of periods to compare against',
    },
    compareSuffix: { control: 'text' },
    yAxisFormat: {
      control: 'select',
      options: ['SMART_NUMBER', '.2f', '.0%', '$,.2f', '.3s', ',d'],
    },
  },
};

export const BasicWithTrendline = ({
  width,
  height,
  showTrendLine,
  startYAxisAtZero,
  compareLag,
  compareSuffix,
  yAxisFormat,
}: {
  width: number;
  height: number;
  showTrendLine: boolean;
  startYAxisAtZero: boolean;
  compareLag: number;
  compareSuffix: string;
  yAxisFormat: string;
}) => (
  <SuperChart
    chartType="big-number"
    width={width}
    height={height}
    queriesData={[{ data: testData }]}
    formData={{
      ...formData,
      show_trend_line: showTrendLine,
      start_y_axis_at_zero: startYAxisAtZero,
      compare_lag: compareLag,
      compare_suffix: compareSuffix,
      y_axis_format: yAxisFormat,
    }}
  />
);

export const weeklyTimeGranularity = () => (
  <SuperChart
    chartType="big-number"
    width={400}
    height={400}
    queriesData={[{ data: testData }]}
    formData={{
      ...formData,
      time_grain_sqla: 'P1W',
    }}
  />
);

export const nullInTheMiddle = () => (
  <SuperChart
    chartType="big-number"
    width={400}
    height={400}
    queriesData={[{ data: withNulls(testData, 3) }]}
    formData={formData}
  />
);

export const fixedRange = () => (
  <SuperChart
    chartType="big-number"
    width={400}
    height={400}
    queriesData={[
      {
        data: testData.slice(0, 9),
        from_dttm: testData[testData.length - 1][TIME_COLUMN],
        to_dttm: null,
      },
    ]}
    formData={{
      ...formData,
      time_range_fixed: true,
    }}
  />
);

export const noFixedRange = () => (
  <SuperChart
    chartType="big-number"
    width={400}
    height={400}
    queriesData={[
      {
        data: testData.slice(0, 9),
        from_dttm: testData[testData.length - 1][TIME_COLUMN],
        to_dttm: testData[0][TIME_COLUMN],
      },
    ]}
    formData={{
      ...formData,
      time_range_fixed: false,
    }}
  />
);
