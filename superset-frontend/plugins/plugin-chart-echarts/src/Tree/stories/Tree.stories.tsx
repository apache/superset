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
  EchartsTreeChartPlugin,
  TreeTransformProps,
} from '@superset-ui/plugin-chart-echarts';
import data from './data';
import { withResizableChartDemo } from '@storybook-shared';

new EchartsTreeChartPlugin().configure({ key: 'echarts-tree' }).register();

getChartTransformPropsRegistry().registerValue(
  'echarts-tree',
  TreeTransformProps,
);

export default {
  title: 'Chart Plugins/plugin-chart-echarts/Tree',
  decorators: [withResizableChartDemo],
  args: {
    colorScheme: 'bnbColors',
    layout: 'orthogonal',
    orient: 'LR',
    symbol: 'circle',
    symbolSize: 7,
    roam: true,
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
      options: ['orthogonal', 'radial'],
      description: 'Layout type: orthogonal (rectangular) or radial (circular)',
    },
    orient: {
      control: 'select',
      options: ['LR', 'RL', 'TB', 'BT'],
      description:
        'Orientation: Left-Right, Right-Left, Top-Bottom, Bottom-Top',
    },
    symbol: {
      control: 'select',
      options: [
        'emptyCircle',
        'circle',
        'rect',
        'triangle',
        'diamond',
        'pin',
        'arrow',
      ],
    },
    symbolSize: {
      control: { type: 'range', min: 5, max: 30, step: 1 },
    },
    roam: {
      control: 'boolean',
      description: 'Enable zoom and pan',
    },
  },
};

export const Tree = ({
  colorScheme,
  layout,
  orient,
  symbol,
  symbolSize,
  roam,
  width,
  height,
}: {
  colorScheme: string;
  layout: string;
  orient: string;
  symbol: string;
  symbolSize: number;
  roam: boolean;
  width: number;
  height: number;
}) => (
  <SuperChart
    theme={supersetTheme}
    chartType="echarts-tree"
    width={width}
    height={height}
    queriesData={[{ data }]}
    formData={{
      color_scheme: colorScheme,
      datasource: '3__table',
      granularity_sqla: 'ds',
      metric: 'count',
      id: 'id_column',
      root_node_id: '1',
      parent: 'parent_column',
      name: 'name_column',
      layout,
      orient,
      symbol,
      symbol_size: symbolSize,
      roam,
    }}
  />
);
