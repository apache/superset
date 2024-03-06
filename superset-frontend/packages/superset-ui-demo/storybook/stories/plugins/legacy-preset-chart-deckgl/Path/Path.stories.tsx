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
import { SuperChart, useTheme } from '@superset-ui/core';
import { PathChartPlugin } from '@superset-ui/legacy-preset-chart-deckgl';
import { payload } from './payload';
import dummyDatasource from '../../../../shared/dummyDatasource';

new PathChartPlugin().configure({ key: 'deck_path' }).register();

export default {
  title: 'Legacy Chart Plugins/legacy-preset-chart-deckgl/PathChartPlugin',
};

export const PathChartViz = () => {
  const theme = useTheme();
  return (
    <SuperChart
      chartType="deck_path"
      width={400}
      height={400}
      datasource={dummyDatasource}
      queriesData={[payload(theme)]}
      formData={{
        datasource: '11__table',
        viz_type: 'deck_path',
        slice_id: 72,
        url_params: {},
        granularity_sqla: null,
        time_grain_sqla: null,
        time_range: '+:+',
        line_column: 'path_json',
        line_type: 'json',
        row_limit: 5000,
        filter_nulls: true,
        adhoc_filters: [],
        mapbox_style: 'mapbox://styles/mapbox/light-v9',
        viewport: {
          altitude: 1.5,
          bearing: 0,
          height: 1094,
          latitude: 37.73671752604488,
          longitude: -122.18885402582598,
          maxLatitude: 85.05113,
          maxPitch: 60,
          maxZoom: 20,
          minLatitude: -85.05113,
          minPitch: 0,
          minZoom: 0,
          pitch: 0,
          width: 669,
          zoom: 9.51847667620428,
        },
        color_picker: { a: 1, b: 135, g: 122, r: 0 },
        line_width: 150,
        reverse_long_lat: false,
        autozoom: true,
        js_columns: ['color'],
        js_data_mutator: '',
        js_tooltip: '',
        js_onclick_href: '',
      }}
    />
  );
};
