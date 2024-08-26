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
import { ArcChartPlugin } from '@superset-ui/legacy-preset-chart-deckgl';
import payload from './payload';
import dummyDatasource from '../../../../shared/dummyDatasource';

new ArcChartPlugin().configure({ key: 'deck_arc' }).register();

export default {
  title: 'Legacy Chart Plugins/legacy-preset-chart-deckgl/ArcChartPlugin',
};

export const ArcChartViz = () => (
  <SuperChart
    chartType="deck_arc"
    width={400}
    height={400}
    datasource={dummyDatasource}
    queriesData={[payload]}
    formData={{
      datasource: '10__table',
      viz_type: 'deck_arc',
      granularity_sqla: 'dttm',
      time_grain_sqla: null,
      time_range: ' : ',
      start_spatial: {
        latCol: 'LATITUDE',
        lonCol: 'LONGITUDE',
        type: 'latlong',
      },
      end_spatial: {
        latCol: 'LATITUDE_DEST',
        lonCol: 'LONGITUDE_DEST',
        type: 'latlong',
      },
      row_limit: 5000,
      filter_nulls: true,
      adhoc_filters: [],
      mapbox_style: 'mapbox://styles/mapbox/light-v9',
      viewport: {
        altitude: 1.5,
        bearing: 8.546256357301871,
        height: 642,
        latitude: 44.596651438714254,
        longitude: -91.84340711201104,
        maxLatitude: 85.05113,
        maxPitch: 60,
        maxZoom: 20,
        minLatitude: -85.05113,
        minPitch: 0,
        minZoom: 0,
        pitch: 60,
        width: 997,
        zoom: 2.929837070560775,
      },
      autozoom: true,
      color_picker: {
        a: 1,
        b: 135,
        g: 122,
        r: 0,
      },
      target_color_picker: {
        r: 0,
        g: 122,
        b: 135,
        a: 1,
      },
      dimension: null,
      label_colors: {},
      stroke_width: 1,
      legend_position: 'tr',
      legend_format: null,
      js_columns: [],
      js_data_mutator: '',
      js_tooltip: '',
      js_onclick_href: '',
    }}
  />
);
