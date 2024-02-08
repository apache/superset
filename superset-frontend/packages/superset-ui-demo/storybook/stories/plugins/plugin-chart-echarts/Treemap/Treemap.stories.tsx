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
  EchartsTreemapChartPlugin,
  TreemapTransformProps,
} from '@superset-ui/plugin-chart-echarts';
import data from './data';
import { withResizableChartDemo } from '../../../../shared/components/ResizableChartDemo';

new EchartsTreemapChartPlugin()
  .configure({ key: 'echarts-treemap' })
  .register();

getChartTransformPropsRegistry().registerValue(
  'echarts-treemap',
  TreemapTransformProps,
);

export default {
  title: 'Chart Plugins/plugin-chart-echarts/Treemap',
  decorators: [withResizableChartDemo],
};

export const Treemap = ({ 
  width, 
  height,
  showLabels,
  showUpperLabels,
  labelType,
}: {
  width: number,
  height: number,
  showLabels: boolean,
  showUpperLabels: boolean,
  labelType: string,
}) => (
  <SuperChart
    chartType="echarts-treemap"
    width={width}
    height={height}
    queriesData={[{ data }]}
    formData={{
      colorScheme: 'supersetColors',
      groupby: ['genre'],
      metric: 'count',
      showLabels,
      showUpperLabels,
      labelType,
    }}
  />
);

Treemap.args = {
  showLabels: true,
  showUpperLabels: true,
  labelType: 'key_value',
}

Treemap.argTypes = {
  showLabels: { control: 'boolean' },
  showUpperLabels: { control: 'boolean' },
  labelType: { 
    control: 'select',
    options: ['key', 'value', 'key_value'], 
  },
};