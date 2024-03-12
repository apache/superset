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
import React from 'react';
import { SuperChart } from '@superset-ui/core';
import { ScatterChartPlugin } from '@superset-ui/legacy-preset-chart-deckgl';
import payload from './payload';
import dummyDatasource from '../../../../shared/dummyDatasource';

new ScatterChartPlugin().configure({ key: 'deck_scatter' }).register();

export default {
  title: 'Legacy Chart Plugins/legacy-preset-chart-deckgl/ScatterChartPlugin',
};

export const ScatterChartViz = () => (
  <SuperChart
    chartType="deck_scatter"
    width={400}
    height={400}
    datasource={dummyDatasource}
    queriesData={[payload]}
    formData={{
      datasource: '5__table',
      viz_type: 'deck_scatter',
      slice_id: 66,
      url_params: {},
      granularity_sqla: 'dttm',
      time_grain_sqla: null,
      time_range: '+:+',
      spatial: { latCol: 'LAT', lonCol: 'LON', type: 'latlong' },
      row_limit: 5000,
      filter_nulls: true,
      adhoc_filters: [],
      mapbox_style: 'mapbox://styles/mapbox/light-v9',
      viewport: {
        bearing: -4.952916738791771,
        latitude: 37.78926922909199,
        longitude: -122.42613341901688,
        pitch: 4.750411100577438,
        zoom: 12.729132798697304,
      },
      autozoom: true,
      point_radius_fixed: { type: 'metric', value: 'count' },
      point_unit: 'square_m',
      min_radius: 2,
      max_radius: 250,
      multiplier: 10,
      color_picker: { a: 0.82, b: 3, g: 0, r: 205 },
      legend_position: 'tr',
      legend_format: null,
      dimension: null,
      color_scheme: 'bnbColors',
      label_colors: {},
      js_columns: [],
      js_data_mutator: '',
      js_tooltip: '',
      js_onclick_href: '',
      granularity: null,
    }}
  />
);
