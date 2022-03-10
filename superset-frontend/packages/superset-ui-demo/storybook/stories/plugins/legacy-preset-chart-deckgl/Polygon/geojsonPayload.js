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

export default {
  cache_key: '31946c4488d1899827d283b668d83281',
  cached_dttm: '2020-03-04T22:40:59',
  cache_timeout: 129600,
  error: null,
  form_data: {
    datasource: '93829__table',
    viz_type: 'deck_polygon',
    url_params: {},
    granularity_sqla: null,
    time_range: '100 years ago : ',
    line_column: 'geometry',
    line_type: 'json',
    adhoc_filters: [
      {
        clause: 'WHERE',
        expressionType: 'SIMPLE',
        filterOptionName: '4ea1a468-43f9-45f0-9655-576d2ab04bc1',
        comparator: '',
        operator: 'IS NOT NULL',
        subject: 'geometry',
      },
    ],
    metric: 'count',
    point_radius_fixed: {
      type: 'fix',
      value: 1000,
    },
    row_limit: 1000,
    reverse_long_lat: false,
    filter_nulls: true,
    mapbox_style: 'mapbox://styles/mapbox/light-v9',
    viewport: {
      longitude: 6.85236157047845,
      latitude: 31.222656842808707,
      zoom: 1,
      bearing: 0,
      pitch: 0,
    },
    autozoom: true,
    fill_color_picker: {
      r: 0,
      g: 122,
      b: 135,
      a: 1,
    },
    stroke_color_picker: {
      r: 0,
      g: 122,
      b: 135,
      a: 1,
    },
    filled: true,
    stroked: false,
    extruded: true,
    multiplier: 1,
    line_width: 10,
    linear_color_scheme: 'blue_white_yellow',
    opacity: 80,
    num_buckets: 5,
    table_filter: false,
    toggle_polygons: true,
    legend_position: 'tr',
    legend_format: null,
    js_columns: [],
    where: '',
    having: '',
    having_filters: [],
    filters: [
      {
        col: 'geometry',
        op: 'IS NOT NULL',
        val: '',
      },
    ],
  },
  is_cached: true,
  status: 'success',
  stacktrace: null,
  rowcount: 1,
  data: {
    features: [
      {
        count: 10,
        name: 'Test',
        polygon: {
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'Polygon',
            coordinates: [
              [
                [-149.95132113447022, 61.1310423022678],
                [-149.95386039742468, 61.12975642234931],
                [-149.9529189574033, 61.128200857856946],
                [-149.94943860572158, 61.12793112735274],
                [-149.9468993514573, 61.12921688848983],
                [-149.94784044016444, 61.1307724989074],
                [-149.95132113447022, 61.1310423022678],
              ],
            ],
          },
        },
        __timestamp: null,
        elevation: 0,
      },
    ],
    mapboxApiKey:
      'pk.eyJ1IjoiZ2tlZWUiLCJhIjoiY2lvbmN5dXhtMDA4NXRybTJjZWU2ZHVxOSJ9.CJG_6Oz52y5yI5cr3Ct_aQ',
    metricLabels: ['count'],
  },
};
