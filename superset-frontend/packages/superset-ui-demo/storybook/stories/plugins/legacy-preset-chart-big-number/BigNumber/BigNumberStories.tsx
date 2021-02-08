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
import React from 'react';
import { SuperChart } from '@superset-ui/core';
import { BigNumberChartPlugin } from '@superset-ui/legacy-preset-chart-big-number';
import testData from './data';

new BigNumberChartPlugin().configure({ key: 'big-number' }).register();

const TIME_COLUMN = '__timestamp';

const formData = {
  colorPicker: {
    r: 0,
    g: 122,
    b: 135,
    a: 1,
  },
  compareLag: 1,
  compareSuffix: 'over 10Y',
  metric: 'sum__SP_POP_TOTL',
  showTrendLine: true,
  startYAxisAtZero: true,
  timeGrainSqla: 'P1Y',
  vizType: 'big_number',
  yAxisFormat: '.3s',
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
  title: 'Legacy Chart Plugins|legacy-preset-big-number/BigNumber',
};

export const basicWithTrendline = () => (
  <SuperChart
    chartType="big-number"
    width={400}
    height={400}
    queriesData={[{ data: testData }]}
    formData={formData}
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
      timeGrainSqla: 'P1W',
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
      timeRangeFixed: true,
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
      timeRangeFixed: false,
    }}
  />
);
