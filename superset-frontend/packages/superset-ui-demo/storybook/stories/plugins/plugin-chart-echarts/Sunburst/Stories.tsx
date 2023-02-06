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
import { boolean, withKnobs } from '@storybook/addon-knobs';
import {
  EchartsSunburstChartPlugin,
  SunburstTransformProps,
} from '@superset-ui/plugin-chart-echarts';
import { withResizableChartDemo } from '../../../../shared/components/ResizableChartDemo';
import data from './data';

new EchartsSunburstChartPlugin()
  .configure({ key: 'echarts-sunburst' })
  .register();

getChartTransformPropsRegistry().registerValue(
  'echarts-sunburst',
  SunburstTransformProps,
);

export default {
  title: 'Chart Plugins/plugin-chart-echarts/Sunburst',
  decorators: [withKnobs, withResizableChartDemo],
};

export const Sunburst = ({ width, height }) => (
  <SuperChart
    chartType="echarts-sunburst"
    width={width}
    height={height}
    queriesData={[{ data }]}
    formData={{
      columns: ['genre', 'platform'],
      metric: 'count',
      showLabels: boolean('Show labels', true),
      showTotal: boolean('Show total', true),
    }}
  />
);
