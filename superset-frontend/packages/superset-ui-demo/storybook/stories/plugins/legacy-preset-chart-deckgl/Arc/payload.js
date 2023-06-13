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

/* eslint-disable sort-keys, no-magic-numbers */

export default {
  cache_key: null,
  cached_dttm: null,
  cache_timeout: 86400,
  error: null,
  form_data: {
    datasource: '10__table',
    viz_type: 'deck_arc',
    slice_id: 71,
    url_params: {},
    granularity_sqla: 'dttm',
    time_grain_sqla: null,
    time_range: ' : ',
    start_spatial: {
      type: 'latlong',
      latCol: 'LATITUDE',
      lonCol: 'LONGITUDE',
    },
    end_spatial: {
      type: 'latlong',
      latCol: 'LATITUDE_DEST',
      lonCol: 'LONGITUDE_DEST',
    },
    row_limit: 5000,
    filter_nulls: true,
    adhoc_filters: [
      {
        clause: 'WHERE',
        expressionType: 'SIMPLE',
        filterOptionName: '1b92e906-53a1-48e2-8e45-056fc5c9d2dc',
        comparator: '',
        operator: 'IS NOT NULL',
        subject: 'LATITUDE',
      },
      {
        clause: 'WHERE',
        expressionType: 'SIMPLE',
        filterOptionName: '0ec864e8-e3e1-42cc-b0f8-4620dfc1c806',
        comparator: '',
        operator: 'IS NOT NULL',
        subject: 'LATITUDE_DEST',
      },
      {
        clause: 'WHERE',
        expressionType: 'SIMPLE',
        filterOptionName: 'ecf4d524-eb35-45a8-b928-91398ebcf498',
        comparator: '',
        operator: 'IS NOT NULL',
        subject: 'LONGITUDE',
      },
      {
        clause: 'WHERE',
        expressionType: 'SIMPLE',
        filterOptionName: '5297586e-9c42-4c5a-bd5d-8a5fed4d698f',
        comparator: '',
        operator: 'IS NOT NULL',
        subject: 'LONGITUDE_DEST',
      },
    ],
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
    color_scheme: 'bnbColors',
    label_colors: {},
    stroke_width: 1,
    legend_position: 'tr',
    legend_format: null,
    js_columns: [],
    where: '',
    having: '',
    filters: [
      {
        col: 'LATITUDE',
        op: 'IS NOT NULL',
        val: '',
      },
      {
        col: 'LATITUDE_DEST',
        op: 'IS NOT NULL',
        val: '',
      },
      {
        col: 'LONGITUDE',
        op: 'IS NOT NULL',
        val: '',
      },
      {
        col: 'LONGITUDE_DEST',
        op: 'IS NOT NULL',
        val: '',
      },
    ],
  },
  is_cached: false,
  query:
    'SELECT "LATITUDE" AS "LATITUDE",\n       "LONGITUDE" AS "LONGITUDE",\n       "LONGITUDE_DEST" AS "LONGITUDE_DEST",\n       "LATITUDE_DEST" AS "LATITUDE_DEST"\nFROM flights\nWHERE "LATITUDE" IS NOT NULL\n  AND "LATITUDE_DEST" IS NOT NULL\n  AND "LONGITUDE" IS NOT NULL\n  AND "LONGITUDE_DEST" IS NOT NULL\nLIMIT 5000\nOFFSET 0',
  status: 'success',
  stacktrace: null,
  rowcount: 5000,
  data: {
    features: [
      {
        sourcePosition: [-149.99618999999998, 61.174319999999994],
        targetPosition: [-122.30931000000001, 47.44898],
        cat_color: null,
        __timestamp: null,
      },
      {
        sourcePosition: [-118.40807, 33.94254],
        targetPosition: [-80.09559, 26.683159999999997],
        cat_color: null,
        __timestamp: null,
      },
      {
        sourcePosition: [-122.37483999999999, 37.619],
        targetPosition: [-80.94313000000001, 35.214009999999995],
        cat_color: null,
        __timestamp: null,
      },
      {
        sourcePosition: [-118.40807, 33.94254],
        targetPosition: [-80.29056, 25.79325],
        cat_color: null,
        __timestamp: null,
      },
      {
        sourcePosition: [-122.30931000000001, 47.44898],
        targetPosition: [-149.99618999999998, 61.174319999999994],
        cat_color: null,
        __timestamp: null,
      },
      {
        sourcePosition: [-122.37483999999999, 37.619],
        targetPosition: [-93.21692, 44.88055],
        cat_color: null,
        __timestamp: null,
      },
      {
        sourcePosition: [-115.15233, 36.08036],
        targetPosition: [-93.21692, 44.88055],
        cat_color: null,
        __timestamp: null,
      },
      {
        sourcePosition: [-118.40807, 33.94254],
        targetPosition: [-80.94313000000001, 35.214009999999995],
        cat_color: null,
        __timestamp: null,
      },
      {
        sourcePosition: [-122.37483999999999, 37.619],
        targetPosition: [-97.0372, 32.89595],
        cat_color: null,
        __timestamp: null,
      },
      {
        sourcePosition: [-115.15233, 36.08036],
        targetPosition: [-84.42694, 33.640440000000005],
        cat_color: null,
        __timestamp: null,
      },
      {
        sourcePosition: [-104.667, 39.85841],
        targetPosition: [-84.42694, 33.640440000000005],
        cat_color: null,
        __timestamp: null,
      },
      {
        sourcePosition: [-115.15233, 36.08036],
        targetPosition: [-80.29056, 25.79325],
        cat_color: null,
        __timestamp: null,
      },
      {
        sourcePosition: [-118.40807, 33.94254],
        targetPosition: [-93.21692, 44.88055],
        cat_color: null,
        __timestamp: null,
      },
      {
        sourcePosition: [-111.97776999999999, 40.78839],
        targetPosition: [-84.42694, 33.640440000000005],
        cat_color: null,
        __timestamp: null,
      },
      {
        sourcePosition: [-122.30931000000001, 47.44898],
        targetPosition: [-93.21692, 44.88055],
        cat_color: null,
        __timestamp: null,
      },
      {
        sourcePosition: [-149.99618999999998, 61.174319999999994],
        targetPosition: [-122.30931000000001, 47.44898],
        cat_color: null,
        __timestamp: null,
      },
      {
        sourcePosition: [-149.99618999999998, 61.174319999999994],
        targetPosition: [-122.30931000000001, 47.44898],
        cat_color: null,
        __timestamp: null,
      },
      {
        sourcePosition: [-122.37483999999999, 37.619],
        targetPosition: [-95.33972, 29.98047],
        cat_color: null,
        __timestamp: null,
      },
      {
        sourcePosition: [-149.99618999999998, 61.174319999999994],
        targetPosition: [-122.5975, 45.58872],
        cat_color: null,
        __timestamp: null,
      },
    ],
    mapboxApiKey:
      'pk.eyJ1Ijoia3Jpc3R3IiwiYSI6ImNqbGg1N242NTFlczczdnBhazViMjgzZ2sifQ.lUneM-o3NucXN189EYyXxQ',
  },
};
