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

import { SuperChart, VizType } from '@superset-ui/core';
import { BulletChartPlugin } from '@superset-ui/legacy-preset-chart-nvd3';
import { dummyDatasource, withResizableChartDemo } from '@storybook-shared';
import data from './data';

new BulletChartPlugin().configure({ key: VizType.Bullet }).register();

export default {
  title: 'Legacy Chart Plugins/legacy-preset-chart-nvd3/Bullet',
  decorators: [withResizableChartDemo],
  args: {
    ranges: '0, 50, 75, 100',
    rangeLabels: 'Low, Medium, High',
    markers: '65',
    markerLabels: 'Target',
  },
  argTypes: {
    ranges: {
      control: 'text',
      description: 'Comma-separated range values',
    },
    rangeLabels: {
      control: 'text',
      description: 'Comma-separated range labels',
    },
    markers: {
      control: 'text',
      description: 'Comma-separated marker values',
    },
    markerLabels: {
      control: 'text',
      description: 'Comma-separated marker labels',
    },
  },
};

export const Basic = ({
  ranges,
  rangeLabels,
  markers,
  markerLabels,
  width,
  height,
}: {
  ranges: string;
  rangeLabels: string;
  markers: string;
  markerLabels: string;
  width: number;
  height: number;
}) => (
  <SuperChart
    chartType={VizType.Bullet}
    width={width}
    height={height}
    datasource={dummyDatasource}
    queriesData={[{ data }]}
    formData={{
      marker_labels: markerLabels,
      marker_line_labels: '',
      marker_lines: '',
      markers,
      range_labels: rangeLabels,
      ranges,
      viz_type: VizType.Bullet,
    }}
  />
);
