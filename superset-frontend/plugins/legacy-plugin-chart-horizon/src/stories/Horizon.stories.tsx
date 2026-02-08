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
import HorizonChartPlugin from '@superset-ui/legacy-plugin-chart-horizon';
import { withResizableChartDemo } from '@storybook-shared';
import data from './data';

new HorizonChartPlugin().configure({ key: VizType.Horizon }).register();

export default {
  title: 'Legacy Chart Plugins/legacy-plugin-chart-horizon',
  decorators: [withResizableChartDemo],
  args: {
    horizonColorScale: 'series',
    seriesHeight: 25,
  },
  argTypes: {
    horizonColorScale: {
      control: 'select',
      options: ['series', 'overall', 'change'],
    },
    seriesHeight: {
      control: { type: 'range', min: 10, max: 100, step: 5 },
      description: 'Height of each series row in pixels',
    },
  },
};

export const Basic = ({
  horizonColorScale,
  seriesHeight,
  width,
  height,
}: {
  horizonColorScale: string;
  seriesHeight: number;
  width: number;
  height: number;
}) => (
  <SuperChart
    chartType={VizType.Horizon}
    width={width}
    height={height}
    queriesData={[{ data }]}
    formData={{
      horizon_color_scale: horizonColorScale,
      series_height: String(seriesHeight),
    }}
  />
);
