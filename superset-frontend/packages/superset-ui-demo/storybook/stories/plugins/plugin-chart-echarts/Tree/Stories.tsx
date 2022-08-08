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
import { select, withKnobs, text, number } from '@storybook/addon-knobs';
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
  decorators: [withKnobs, withResizableChartDemo],
};

export const Tree = ({ width, height }) => (
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
      id: select(
        'Id Column',
        ['id_column', 'name_column', 'parent_column'],
        'id_column',
      ),
      rootNodeId: text('Root Node', '1'),
      parent: select(
        'Parent Column',
        ['parent_column', 'id_column'],
        'parent_column',
      ),
      name: select('Name Column', [null, 'name_column'], 'name_column'),

      position: select(
        'Label Position',
        ['top', 'right', 'left', 'bottom'],
        'top',
      ),
      layout: select('Tree Layout', ['orthogonal', 'radial'], 'orthogonal'),
      orient: select('Orientation', ['LR', 'RL', 'TB', 'BT'], 'LR'),
      emphasis: select('Emphasis', ['ancestor', 'descendant'], 'descendant'),
      symbol: select(
        'Symbol',
        ['emptyCircle', 'circle', 'rect', 'triangle'],
        'circle',
      ),
      symbol_size: number('[Symbol Size', 7, {
        range: true,
        min: 5,
        max: 30,
        step: 2,
      }),
    }}
  />
);
