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
import { SuperChart } from '@superset-ui/core';
import { supersetTheme } from '@apache-superset/core/ui';
import { PolygonChartPlugin } from '@superset-ui/legacy-preset-chart-deckgl';
import { withResizableChartDemo, dummyDatasource } from '@storybook-shared';
import payload from './payload';
import geojsonPayload from './geojsonPayload';

new PolygonChartPlugin().configure({ key: 'deck_polygon' }).register();

export default {
  title: 'Legacy Chart Plugins/legacy-preset-chart-deckgl/PolygonChartPlugin',
  decorators: [withResizableChartDemo],
  args: {
    filled: true,
    stroked: false,
    extruded: true,
    opacity: 80,
    lineWidth: 10,
    autozoom: true,
  },
  argTypes: {
    filled: {
      control: 'boolean',
      description: 'Fill polygons with color',
    },
    stroked: {
      control: 'boolean',
      description: 'Draw polygon outlines',
    },
    extruded: {
      control: 'boolean',
      description: 'Extrude polygons in 3D based on metric values',
    },
    opacity: {
      control: { type: 'range', min: 0, max: 100, step: 5 },
      description: 'Polygon opacity percentage',
    },
    lineWidth: {
      control: { type: 'range', min: 1, max: 100, step: 1 },
      description: 'Width of polygon stroke lines',
    },
    autozoom: { control: 'boolean' },
  },
};

export const PolygonChartViz = ({
  filled,
  stroked,
  extruded,
  opacity,
  lineWidth,
  autozoom,
  width,
  height,
}: {
  filled: boolean;
  stroked: boolean;
  extruded: boolean;
  opacity: number;
  lineWidth: number;
  autozoom: boolean;
  width: number;
  height: number;
}) => (
  <SuperChart
    theme={supersetTheme}
    chartType="deck_polygon"
    width={width}
    height={height}
    datasource={dummyDatasource}
    queriesData={[payload]}
    formData={{
      datasource: '9__table',
      viz_type: 'deck_polygon',
      slice_id: 70,
      url_params: {},
      granularity_sqla: null,
      time_grain_sqla: null,
      time_range: '+:+',
      line_column: 'contour',
      line_type: 'json',
      adhoc_filters: [],
      metric: 'population',
      point_radius_fixed: { type: 'fix', value: 1000 },
      row_limit: 10000,
      reverse_long_lat: false,
      filter_nulls: true,
      mapbox_style: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
      viewport: {
        altitude: 1.5,
        bearing: 37.89506450385642,
        height: 906,
        latitude: 37.752020331384834,
        longitude: -122.43388541747726,
        maxLatitude: 85.05113,
        maxPitch: 60,
        maxZoom: 20,
        minLatitude: -85.05113,
        minPitch: 0,
        minZoom: 0,
        pitch: 60,
        width: 667,
        zoom: 11.133995608594631,
      },
      autozoom,
      fill_color_picker: { a: 1, b: 73, g: 65, r: 3 },
      stroke_color_picker: { a: 1, b: 135, g: 122, r: 0 },
      filled,
      stroked,
      extruded,
      multiplier: 1,
      line_width: lineWidth,
      linear_color_scheme: 'blue_white_yellow',
      opacity,
      num_buckets: 5,
      table_filter: false,
      toggle_polygons: true,
      legend_position: 'tr',
      legend_format: null,
      js_columns: ['population', 'area'],
      js_data_mutator: '',
      js_tooltip: '',
      js_onclick_href: '',
    }}
  />
);

export const GeojsonPolygonViz = ({
  filled,
  stroked,
  extruded,
  opacity,
  lineWidth,
  autozoom,
  width,
  height,
}: {
  filled: boolean;
  stroked: boolean;
  extruded: boolean;
  opacity: number;
  lineWidth: number;
  autozoom: boolean;
  width: number;
  height: number;
}) => (
  <SuperChart
    theme={supersetTheme}
    chartType="deck_polygon"
    width={width}
    height={height}
    datasource={dummyDatasource}
    queriesData={[geojsonPayload]}
    formData={{
      datasource: '9__table',
      viz_type: 'deck_polygon',
      time_range: '+:+',
      line_column: 'contour',
      line_type: 'json',
      adhoc_filters: [],
      metric: 'count',
      point_radius_fixed: { type: 'fix', value: 1000 },
      row_limit: 10000,
      reverse_long_lat: false,
      filter_nulls: true,
      mapbox_style: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
      viewport: {
        longitude: 6.85236157047845,
        latitude: 31.222656842808707,
        zoom: 1,
        bearing: 0,
        pitch: 0,
      },
      autozoom,
      fill_color_picker: { a: 1, b: 73, g: 65, r: 3 },
      stroke_color_picker: { a: 1, b: 135, g: 122, r: 0 },
      filled,
      stroked,
      extruded,
      multiplier: 1,
      line_width: lineWidth,
      linear_color_scheme: 'blue_white_yellow',
      opacity,
      num_buckets: 5,
      table_filter: false,
      toggle_polygons: true,
      legend_position: 'tr',
    }}
  />
);
