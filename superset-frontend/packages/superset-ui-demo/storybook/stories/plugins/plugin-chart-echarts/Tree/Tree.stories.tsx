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
  EchartsTreeChartPlugin,
  TreeTransformProps,
} from '@superset-ui/plugin-chart-echarts';
import data from './data';
import { withResizableChartDemo } from '../../../../shared/components/ResizableChartDemo';

new EchartsTreeChartPlugin().configure({ key: 'echarts-tree' }).register();

getChartTransformPropsRegistry().registerValue(
  'echarts-tree',
  TreeTransformProps,
);

export default {
  title: 'Chart Plugins/plugin-chart-echarts/Tree',
  decorators: [withResizableChartDemo],
};

export const Tree = (
  {
    id,
    rootNodeId,
    parent,
    name,
    position,
    layout,
    orient,
    emphasis,
    symbol,
    symbolSize,
  }: {
    id: string;
    rootNodeId: string;
    parent: string;
    name: string;
    position: string;
    layout: string;
    orient: string;
    emphasis: string;
    symbol: string;
    symbolSize: number;
  },
  { width, height }: { width: number; height: number },
) => (
  <SuperChart
    chartType="echarts-tree"
    width={width}
    height={height}
    queriesData={[{ data }]}
    formData={{
      colorScheme: 'bnbColors',
      datasource: '3__table',
      granularity_sqla: 'ds',
      metric: 'count',
      id,
      rootNodeId,
      parent,
      name,
      position,
      layout,
      orient,
      emphasis,
      symbol,
      symbol_size: symbolSize,
    }}
  />
);

Tree.args = {
  id: 'id_column',
  rootNodeId: '1',
  parent: 'parent_column',
  name: 'name_column',
  position: 'top',
  layout: 'orthogonal',
  orient: 'LR',
  emphasis: 'descendant',
  symbol: 'circle',
  symbolSize: 7,
};

Tree.argTypes = {
  id: {
    control: 'text',
  },
  rootNodeId: {
    control: 'text',
  },
  parent: {
    control: 'text',
  },
  name: {
    control: 'text',
  },
  position: {
    control: 'select',
    options: ['top', 'right', 'left', 'bottom'],
  },
  layout: {
    control: 'select',
    options: ['orthogonal', 'radial'],
  },
  orient: {
    control: 'select',
    options: ['LR', 'RL', 'TB', 'BT'],
  },
  emphasis: {
    control: 'select',
    options: ['ancestor', 'descendant'],
  },
  symbol: {
    control: 'select',
    options: ['emptyCircle', 'circle', 'rect', 'triangle'],
  },
  symbolSize: {
    control: 'number',
    min: 5,
    max: 30,
    step: 2,
  },
};
