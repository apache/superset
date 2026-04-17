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

/* eslint-disable no-magic-numbers, sort-keys */
import { SuperChart } from '@superset-ui/core';
import { supersetTheme } from '@apache-superset/core/ui';
import WorldMapChartPlugin from '@superset-ui/legacy-plugin-chart-world-map';
import { withResizableChartDemo } from '@storybook-shared';
import data from './data';

new WorldMapChartPlugin().configure({ key: 'world-map' }).register();

export default {
  title: 'Legacy Chart Plugins/legacy-plugin-chart-world-map',
  decorators: [withResizableChartDemo],
  args: {
    maxBubbleSize: 25,
    showBubbles: true,
  },
  argTypes: {
    maxBubbleSize: {
      control: { type: 'range', min: 5, max: 100, step: 5 },
      description: 'Maximum size of bubbles on the map',
    },
    showBubbles: { control: 'boolean' },
  },
};

export const Basic = ({
  maxBubbleSize,
  showBubbles,
  width,
  height,
}: {
  maxBubbleSize: number;
  showBubbles: boolean;
  width: number;
  height: number;
}) => (
  <SuperChart
    theme={supersetTheme}
    chartType="world-map"
    width={width}
    height={height}
    queriesData={[{ data }]}
    formData={{
      max_bubble_size: String(maxBubbleSize),
      show_bubbles: showBubbles,
      color_picker: {},
    }}
  />
);
