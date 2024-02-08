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

import React from 'react';
import { SuperChart, getChartTransformPropsRegistry } from '@superset-ui/core';
import {
  EchartsPieChartPlugin,
  PieTransformProps,
} from '@superset-ui/plugin-chart-echarts';
import { weekday, population } from './data';
import { withResizableChartDemo } from '../../../../shared/components/ResizableChartDemo';

new EchartsPieChartPlugin().configure({ key: 'echarts-pie' }).register();

getChartTransformPropsRegistry().registerValue(
  'echarts-pie',
  PieTransformProps,
);

export default {
  title: 'Chart Plugins/plugin-chart-echarts/Pie',
  decorators: [withResizableChartDemo],
};

export const WeekdayPie = (
  {
    donut,
    innerRadius,
    outerRadius,
    labelsOutside,
    labelLine,
    showLabels,
    showLegend,
    labelType,
  }: {
    donut: boolean;
    innerRadius: number;
    outerRadius: number;
    labelsOutside: boolean;
    labelLine: boolean;
    showLabels: boolean;
    showLegend: boolean;
    labelType: string;
  },
  { width, height }: { width: number; height: number },
) => (
  <SuperChart
    chartType="echarts-pie"
    width={width}
    height={height}
    queriesData={[{ data: weekday }]}
    formData={{
      colorScheme: 'supersetColors',
      groupby: ['Day'],
      metric: 'SUM(AIR_TIME)',
      numberFormat: 'SMART_NUMBER',
      donut,
      innerRadius,
      outerRadius,
      labelsOutside,
      labelLine,
      showLabels,
      showLegend,
      labelType,
    }}
  />
);

WeekdayPie.args = {
  donut: false,
  innerRadius: 30,
  outerRadius: 70,
  labelsOutside: true,
  labelLine: true,
  showLabels: true,
  showLegend: false,
  labelType: 'key',
};

WeekdayPie.argTypes = {
  donut: { control: 'boolean' },
  innerRadius: { control: 'number' },
  outerRadius: { control: 'number' },
  labelsOutside: { control: 'boolean' },
  labelLine: { control: 'boolean' },
  showLabels: { control: 'boolean' },
  showLegend: { control: 'boolean' },
  labelType: {
    control: {
      type: 'select',
      options: [
        'key',
        'value',
        'percent',
        'key_value',
        'key_percent',
        'key_value_percent',
      ],
    },
  },
};

export const PopulationPie = ({
  width,
  height,
  donut,
  innerRadius,
  outerRadius,
  labelsOutside,
  labelLine,
  showLabels,
  showLegend,
  labelType,
}: {
  width: number;
  height: number;
  donut: boolean;
  innerRadius: number;
  outerRadius: number;
  labelsOutside: boolean;
  labelLine: boolean;
  showLabels: boolean;
  showLegend: boolean;
  labelType: string;
}) => {
  return (
    <SuperChart
      chartType="echarts-pie"
      width={width}
      height={height}
      queriesData={[{ data: population }]}
      formData={{
        colorScheme: 'supersetColors',
        groupby: ['Country'],
        metric: 'Population',
        numberFormat: 'SMART_NUMBER',
        donut,
        innerRadius,
        outerRadius,
        labelsOutside,
        labelLine,
        showLabels,
        showLegend,
        labelType,
      }}
    />
  );
};

PopulationPie.args = {
  donut: false,
  innerRadius: 30,
  outerRadius: 70,
  labelsOutside: false,
  labelLine: true,
  showLabels: true,
  showLegend: false,
  labelType: 'key',
};

PopulationPie.argTypes = {
  donut: { control: 'boolean' },
  innerRadius: { control: 'number' },
  outerRadius: { control: 'number' },
  labelsOutside: { control: 'boolean' },
  labelLine: { control: 'boolean' },
  showLabels: { control: 'boolean' },
  showLegend: { control: 'boolean' },
  labelType: {
    control: {
      type: 'select',
      options: [
        'key',
        'value',
        'percent',
        'key_value',
        'key_percent',
        'key_value_percent',
      ],
    },
  },
};
