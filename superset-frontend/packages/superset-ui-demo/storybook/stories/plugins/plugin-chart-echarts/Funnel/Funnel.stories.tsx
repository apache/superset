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

import {
  SuperChart,
  VizType,
  getChartTransformPropsRegistry,
} from '@superset-ui/core';
import {
  EchartsFunnelChartPlugin,
  FunnelTransformProps,
} from '@superset-ui/plugin-chart-echarts';
import { dataSource } from './constants';
import { withResizableChartDemo } from '../../../../shared/components/ResizableChartDemo';

new EchartsFunnelChartPlugin().configure({ key: VizType.Funnel }).register();

getChartTransformPropsRegistry().registerValue(
  VizType.Funnel,
  FunnelTransformProps,
);

export default {
  title: 'Chart Plugins/plugin-chart-echarts/Funnel',
  decorators: [withResizableChartDemo],
  args: {
    orient: 'vertical',
    sort: 'descending',
    gap: 0,
    labelType: 'key',
    labelLine: true,
    showLabels: true,
    showLegend: false,
  },
  argTypes: {
    width: { control: 'number' },
    height: { control: 'number' },
    orient: { control: 'select', options: ['horizontal', 'vertical'] },
    sort: { control: 'select', options: ['descending', 'ascending', 'none'] },
    gap: { control: 'number' },
    labelType: {
      control: 'select',
      options: [
        'key',
        'value',
        'percent',
        'key_value',
        'key_percent',
        'key_value_percent',
      ],
    },
    labelLine: { control: 'boolean' },
    showLabels: { control: 'boolean' },
    showLegend: { control: 'boolean' },
  },
};

export const Funnel = (
  {
    orient,
    sort,
    gap,
    labelType,
    labelLine,
    showLabels,
    showLegend,
  }: {
    orient: string;
    sort: string;
    gap: number;
    labelType: string;
    labelLine: boolean;
    showLabels: boolean;
    showLegend: boolean;
  },
  { width, height }: { width: number; height: number },
) => (
  <SuperChart
    chartType={VizType.Funnel}
    width={width}
    height={height}
    queriesData={[{ data: dataSource }]}
    formData={{
      colorScheme: 'supersetColors',
      groupby: ['name'],
      metric: 'value',
      numberFormat: 'SMART_NUMBER',
      orient,
      sort,
      gap,
      labelType,
      labelLine,
      showLabels,
      showLegend,
    }}
  />
);
