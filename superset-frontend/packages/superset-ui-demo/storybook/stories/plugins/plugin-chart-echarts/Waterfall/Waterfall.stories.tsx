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
  EchartsWaterfallChartPlugin,
  WaterfallTransformProps,
} from '@superset-ui/plugin-chart-echarts';
import data from './data';
import { withResizableChartDemo } from '../../../../shared/components/ResizableChartDemo';

new EchartsWaterfallChartPlugin()
  .configure({ key: VizType.Waterfall })
  .register();

getChartTransformPropsRegistry().registerValue(
  VizType.Waterfall,
  WaterfallTransformProps,
);

export default {
  title: 'Chart Plugins/plugin-chart-echarts/Waterfall',
  decorators: [withResizableChartDemo],
};

export const Waterfall = ({
  width,
  height,
}: {
  width: number;
  height: number;
}) => (
  <SuperChart
    chartType={VizType.Waterfall}
    width={width}
    height={height}
    queriesData={[{ data }]}
    formData={{
      metric: `SUM(decomp_volume)`,
      columns: 'due_to_group',
      series: 'period',
      x_ticks_layout: '45°',
      adhocFilters: [
        {
          clause: 'WHERE',
          comparator: '0',
          expressionType: 'SIMPLE',
          filterOptionName: 'filter_8ix98su8zu4_t4767ixmbp9',
          isExtra: false,
          isNew: false,
          operator: '!=',
          sqlExpression: null,
          subject: 'period',
        },
      ],
    }}
  />
);
