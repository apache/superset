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
import { HexChartPlugin } from '@superset-ui/legacy-preset-chart-deckgl';
import payload from './payload';
import dummyDatasource from '../../../../shared/dummyDatasource';

new HexChartPlugin().configure({ key: 'deck_hex' }).register();

export default {
  title: 'Legacy Chart Plugins/legacy-preset-chart-deckgl/HexChartPlugin',
};

export const HexChartViz = () => (
  <SuperChart
    chartType="deck_hex"
    width={400}
    height={400}
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
      mapbox_style: 'mapbox://styles/mapbox/streets-v9',
      viewport: {
        bearing: -2.3984797349335167,
        latitude: 37.789795085160335,
        longitude: -122.40632230075536,
        pitch: 54.08961642447763,
        zoom: 13.835465702403654,
      },
      color_picker: { a: 1, b: 0, g: 255, r: 14 },
      autozoom: true,
      grid_size: 40,
      extruded: true,
      js_agg_function: 'sum',
      js_columns: [],
      js_data_mutator: '',
      js_tooltip: '',
      js_onclick_href: '',
    }}
  />
);
