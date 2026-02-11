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

/* eslint-disable sort-keys */
/* eslint-disable no-magic-numbers */
import { SuperChart } from '@superset-ui/core'
import { supersetTheme } from '@apache-superset/core/ui';
import { HexChartPlugin } from '@superset-ui/legacy-preset-chart-deckgl';
import { withResizableChartDemo, dummyDatasource } from '@storybook-shared';
import payload from './payload';

new HexChartPlugin().configure({ key: 'deck_hex' }).register();

export default {
  title: 'Legacy Chart Plugins/legacy-preset-chart-deckgl/HexChartPlugin',
  decorators: [withResizableChartDemo],
  args: {
    gridSize: 40,
    extruded: true,
    autozoom: true,
  },
  argTypes: {
    gridSize: {
      control: { type: 'range', min: 10, max: 200, step: 10 },
      description: 'Size of hexagon cells in meters',
    },
    extruded: {
      control: 'boolean',
      description: 'Extrude hexagons in 3D',
    },
    autozoom: { control: 'boolean' },
  },
};

export const HexChartViz = ({
  gridSize,
  extruded,
  autozoom,
  width,
  height,
}: {
  gridSize: number;
  extruded: boolean;
  autozoom: boolean;
  width: number;
  height: number;
}) => (
  <SuperChart
      theme={supersetTheme}
    chartType="deck_hex"
    width={width}
    height={height}
    datasource={dummyDatasource}
    queriesData={[payload]}
    formData={{
      datasource: '5__table',
      viz_type: 'deck_hex',
      slice_id: 68,
      url_params: {},
      granularity_sqla: 'dttm',
      time_grain_sqla: null,
      time_range: '+:+',
      spatial: { latCol: 'LAT', lonCol: 'LON', type: 'latlong' },
      size: 'count',
      row_limit: 5000,
      filter_nulls: true,
      adhoc_filters: [],
      mapbox_style: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
      viewport: {
        bearing: -2.3984797349335167,
        latitude: 37.789795085160335,
        longitude: -122.40632230075536,
        pitch: 54.08961642447763,
        zoom: 13.835465702403654,
      },
      color_picker: { a: 1, b: 0, g: 255, r: 14 },
      autozoom,
      grid_size: gridSize,
      extruded,
      js_agg_function: 'sum',
      js_columns: [],
      js_data_mutator: '',
      js_tooltip: '',
      js_onclick_href: '',
    }}
  />
);
