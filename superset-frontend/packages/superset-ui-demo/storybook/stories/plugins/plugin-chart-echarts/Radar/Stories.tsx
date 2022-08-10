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
import { withKnobs } from '@storybook/addon-knobs';
import {
  EchartsRadarChartPlugin,
  RadarTransformProps,
} from '@superset-ui/plugin-chart-echarts';
import { withResizableChartDemo } from '../../../../shared/components/ResizableChartDemo';
import { basic } from './data';

new EchartsRadarChartPlugin().configure({ key: 'echarts-radar' }).register();

getChartTransformPropsRegistry().registerValue(
  'echarts-radar',
  RadarTransformProps,
);

export default {
  title: 'Chart Plugins/plugin-chart-echarts/Radar',
  decorators: [withKnobs, withResizableChartDemo],
};

export const Radar = ({ width, height }) => (
  <SuperChart
    chartType="echarts-radar"
    width={width}
    height={height}
    queriesData={[{ data: basic }]}
    formData={{
      columns: [],
      groupby: ['Sales'],
      metrics: [
        'Sales',
        'Administration',
        'Information Technology',
        'Customer Support',
        'Development',
        'Marketing',
      ],
      columnConfig: {
        Sales: { radarMetricMaxValue: 6500 },
        Administration: { radarMetricMaxValue: 16000 },
        'Information Technology': { radarMetricMaxValue: 30000 },
        'Customer Support': { radarMetricMaxValue: 38000 },
        Development: { radarMetricMaxValue: 52000 },
        Marketing: { radarMetricMaxValue: 25000 },
      },
    }}
  />
);
