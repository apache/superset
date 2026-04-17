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

import { SuperChart } from '@superset-ui/core';
import { supersetTheme } from '@apache-superset/core/ui';
import { WordCloudChartPlugin } from '@superset-ui/plugin-chart-word-cloud';
import { withResizableChartDemo } from '@storybook-shared';
import data from './data';

new WordCloudChartPlugin().configure({ key: 'word-cloud2' }).register();

export default {
  title: 'Chart Plugins/plugin-chart-word-cloud',
  decorators: [withResizableChartDemo],
  args: {
    rotation: 'flat',
    colorScheme: 'd3Category10',
    sizeFrom: 10,
    sizeTo: 70,
  },
  argTypes: {
    rotation: {
      control: 'select',
      options: ['square', 'flat', 'random'],
    },
    colorScheme: {
      control: 'select',
      options: [
        'supersetColors',
        'd3Category10',
        'bnbColors',
        'googleCategory20c',
      ],
    },
    sizeFrom: {
      control: { type: 'range', min: 5, max: 50, step: 5 },
      description: 'Minimum font size',
    },
    sizeTo: {
      control: { type: 'range', min: 20, max: 150, step: 5 },
      description: 'Maximum font size',
    },
  },
};

export const Basic = ({
  rotation,
  colorScheme,
  sizeFrom,
  sizeTo,
  width,
  height,
}: {
  rotation: string;
  colorScheme: string;
  sizeFrom: number;
  sizeTo: number;
  width: number;
  height: number;
}) => (
  <SuperChart
    theme={supersetTheme}
    chartType="word-cloud2"
    width={width}
    height={height}
    queriesData={[{ data }]}
    formData={{
      color_scheme: colorScheme,
      metric: 'sum__num',
      series: 'name',
      rotation,
      size_from: sizeFrom,
      size_to: sizeTo,
    }}
  />
);
