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
import {
  EchartsGraphChartPlugin,
  GraphTransformProps,
} from '@superset-ui/plugin-chart-echarts';
import { basic } from './data';
import { withResizableChartDemo } from '@storybook-shared';

new EchartsGraphChartPlugin().configure({ key: 'echarts-graph' }).register();

getChartTransformPropsRegistry().registerValue(
  'echarts-graph',
  GraphTransformProps,
);

export default {
  title: 'Chart Plugins/plugin-chart-echarts/Graph',
  decorators: [withResizableChartDemo],
  args: {
    colorScheme: 'supersetColors',
    layout: 'force',
    showLegend: true,
    roam: true,
    draggable: true,
    repulsion: 1000,
    gravity: 0.3,
    edgeLength: 400,
    showSymbolThreshold: 0,
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
    layout: {
      control: 'select',
      options: ['force', 'circular'],
    },
    showLegend: { control: 'boolean' },
    roam: {
      control: 'boolean',
      description: 'Enable zooming and panning',
    },
    draggable: {
      control: 'boolean',
      description: 'Enable dragging nodes',
    },
    repulsion: {
      control: { type: 'range', min: 100, max: 5000, step: 100 },
      description: 'Force repulsion between nodes',
    },
    gravity: {
      control: { type: 'range', min: 0, max: 1, step: 0.1 },
      description: 'Gravity towards center',
    },
    edgeLength: {
      control: { type: 'range', min: 50, max: 1000, step: 50 },
      description: 'Expected edge length',
    },
    showSymbolThreshold: {
      control: { type: 'range', min: 0, max: 100, step: 10 },
      description: 'Hide labels below this threshold',
    },
  },
};

export const Graph = ({
  width,
  height,
  colorScheme,
  layout,
  showLegend,
  roam,
  draggable,
  repulsion,
  gravity,
  edgeLength,
  showSymbolThreshold,
}: {
  width: number;
  height: number;
  colorScheme: string;
  layout: string;
  showLegend: boolean;
  roam: boolean;
  draggable: boolean;
  repulsion: number;
  gravity: number;
  edgeLength: number;
  showSymbolThreshold: number;
}) => (
  <SuperChart
    chartType="echarts-graph"
    width={width}
    height={height}
    queriesData={[{ data: basic }]}
    formData={{
      source: 'source',
      target: 'target',
      sourceCategory: 'sourceCategory',
      targetCategory: 'targetCategory',
      metric: 'value',
      colorScheme,
      layout,
      showLegend,
      roam,
      draggable,
      repulsion,
      gravity,
      edgeLength,
      showSymbolThreshold,
    }}
  />
);
