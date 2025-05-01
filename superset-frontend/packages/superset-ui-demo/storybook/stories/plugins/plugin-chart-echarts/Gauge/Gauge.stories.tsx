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
  EchartsGaugeChartPlugin,
  GaugeTransformProps,
} from '@superset-ui/plugin-chart-echarts';
import { withResizableChartDemo } from '../../../../shared/components/ResizableChartDemo';
import { speed } from './data';

new EchartsGaugeChartPlugin().configure({ key: 'echarts-gauge' }).register();

getChartTransformPropsRegistry().registerValue(
  'echarts-gauge',
  GaugeTransformProps,
);

export default {
  title: 'Chart Plugins/plugin-chart-echarts/Gauge',
  decorators: [withResizableChartDemo],
};

export const Gauge = ({ width, height }: { width: number; height: number }) => (
  <SuperChart
    chartType="echarts-gauge"
    width={width}
    height={height}
    queriesData={[{ data: speed }]}
    formData={{
      columns: [],
      groupby: ['name'],
      metric: 'value',
    }}
  />
);
