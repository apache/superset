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

import { SuperChart, getChartTransformPropsRegistry } from '@superset-ui/core';
import { supersetTheme } from '@apache-superset/core/ui';
import {
  EchartsGaugeChartPlugin,
  GaugeTransformProps,
} from '@superset-ui/plugin-chart-echarts';
import { withResizableChartDemo } from '@storybook-shared';
import { speed } from './data';

new EchartsGaugeChartPlugin().configure({ key: 'echarts-gauge' }).register();

getChartTransformPropsRegistry().registerValue(
  'echarts-gauge',
  GaugeTransformProps,
);

export default {
  title: 'Chart Plugins/plugin-chart-echarts/Gauge',
  decorators: [withResizableChartDemo],
  args: {
    colorScheme: 'supersetColors',
    showProgress: true,
    showPointer: true,
    splitNumber: 10,
    numberFormat: 'SMART_NUMBER',
    minVal: 0,
    maxVal: 100,
    startAngle: 225,
    endAngle: -45,
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
    showProgress: { control: 'boolean' },
    showPointer: { control: 'boolean' },
    splitNumber: { control: { type: 'range', min: 2, max: 20, step: 1 } },
    numberFormat: {
      control: 'select',
      options: ['SMART_NUMBER', '.2f', '.0%', '$,.2f', '.3s'],
    },
    minVal: { control: 'number' },
    maxVal: { control: 'number' },
    startAngle: { control: { type: 'range', min: 0, max: 360, step: 15 } },
    endAngle: { control: { type: 'range', min: -360, max: 0, step: 15 } },
  },
};

export const Gauge = ({
  width,
  height,
  colorScheme,
  showProgress,
  showPointer,
  splitNumber,
  numberFormat,
  minVal,
  maxVal,
  startAngle,
  endAngle,
}: {
  width: number;
  height: number;
  colorScheme: string;
  showProgress: boolean;
  showPointer: boolean;
  splitNumber: number;
  numberFormat: string;
  minVal: number;
  maxVal: number;
  startAngle: number;
  endAngle: number;
}) => (
  <SuperChart
    theme={supersetTheme}
    chartType="echarts-gauge"
    width={width}
    height={height}
    queriesData={[{ data: speed }]}
    formData={{
      columns: [],
      groupby: ['name'],
      metric: 'value',
      colorScheme,
      showProgress,
      showPointer,
      splitNumber,
      numberFormat,
      minVal,
      maxVal,
      startAngle,
      endAngle,
    }}
  />
);
