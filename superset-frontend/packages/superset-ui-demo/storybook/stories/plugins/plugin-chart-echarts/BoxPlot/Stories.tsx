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
import { select, withKnobs } from '@storybook/addon-knobs';
import {
  EchartsBoxPlotChartPlugin,
  BoxPlotTransformProps,
} from '@superset-ui/plugin-chart-echarts';
import data from './data';
import { withResizableChartDemo } from '../../../../shared/components/ResizableChartDemo';

new EchartsBoxPlotChartPlugin()
  .configure({ key: 'echarts-boxplot' })
  .register();

getChartTransformPropsRegistry().registerValue(
  'echarts-boxplot',
  BoxPlotTransformProps,
);

export default {
  title: 'Chart Plugins/plugin-chart-echarts/BoxPlot',
  decorators: [withKnobs, withResizableChartDemo],
};

export const BoxPlot = ({ width, height }) => (
  <SuperChart
    chartType="echarts-boxplot"
    width={width}
    height={height}
    queriesData={[{ data }]}
    formData={{
      columns: [],
      groupby: ['type', 'region'],
      metrics: ['AVG(averageprice)'],
      whiskerOptions: 'Tukey',
      xTicksLayout: select(
        'X Tick Layout',
        ['auto', 'flat', '45°', '90°', 'staggered'],
        '45°',
      ),
      yAxisFormat: 'SMART_NUMBER',
    }}
  />
);
