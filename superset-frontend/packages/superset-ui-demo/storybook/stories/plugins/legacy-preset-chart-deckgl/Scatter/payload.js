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
export default {
  cache_key: null,
  cached_dttm: null,
  cache_timeout: 86400,
  error: null,
  form_data: {
    color_picker: { a: 0.82, b: 3, g: 0, r: 205 },
    datasource: '5__table',
    granularity_sqla: 'dttm',
    groupby: [],
    mapbox_style: 'mapbox://styles/mapbox/light-v9',
    multiplier: 10,
    point_radius_fixed: { type: 'metric', value: 'count' },
    point_unit: 'square_m',
    row_limit: 5000,
    size: 'count',
    spatial: { latCol: 'LAT', lonCol: 'LON', type: 'latlong' },
    time_grain_sqla: null,
    viewport: {
      bearing: -4.952916738791771,
      latitude: 37.78926922909199,
      longitude: -122.42613341901688,
      pitch: 4.750411100577438,
      zoom: 12.729132798697304,
    },
    viz_type: 'deck_scatter',
    slice_id: 66,
    time_range: ' : ',
    adhoc_filters: [
      {
        clause: 'WHERE',
        expressionType: 'SIMPLE',
        filterOptionName: 'b0487cd7-2139-476f-a388-1f0f9759530f',
        comparator: '',
        operator: 'IS NOT NULL',
        subject: 'LAT',
      },
      {
        clause: 'WHERE',
        expressionType: 'SIMPLE',
        filterOptionName: '9398a511-3673-468c-b47e-634f59358b6f',
        comparator: '',
        operator: 'IS NOT NULL',
        subject: 'LON',
      },
    ],
    where: '',
    having: '',
    having_filters: [],
    filters: [
      { col: 'LAT', op: 'IS NOT NULL', val: '' },
      { col: 'LON', op: 'IS NOT NULL', val: '' },
    ],
  },
  is_cached: false,
  query:
    'SELECT "LAT" AS "LAT",\n       "LON" AS "LON",\n       COUNT(*) AS count\nFROM\n  (SELECT datetime,\n          ROUND(LON*10000000)/10000000 as LON,\n          ROUND(LAT*10000000)/10000000 as LAT, NUMBER , STREET,\n                                                        UNIT,\n                                                        CITY,\n                                                        DISTRICT,\n                                                        REGION,\n                                                        POSTCODE,\n                                                        ID occupancy,\n                                                        radius_miles,\n                                                        geohash,\n                                                        delimited\n   FROM long_lat) AS expr_qry\nWHERE "LAT" IS NOT NULL\n  AND "LON" IS NOT NULL\nGROUP BY "LAT",\n         "LON"\nORDER BY count DESC\nLIMIT 5000\nOFFSET 0',
  status: 'success',
  stacktrace: null,
  rowcount: 5000,
  data: {
    features: [
      {
        metric: 2415,
        radius: 2415,
        cat_color: null,
        position: [-122.4221936, 37.7786083],
        __timestamp: null,
      },
      {
        metric: 2391,
        radius: 2391,
        cat_color: null,
        position: [-122.4101989, 37.7878771],
        __timestamp: null,
      },
      {
        metric: 1349,
        radius: 1349,
        cat_color: null,
        position: [-122.4205965, 37.8054735],
        __timestamp: null,
      },
      {
        metric: 1004,
        radius: 1004,
        cat_color: null,
        position: [-122.4125137, 37.7908413],
        __timestamp: null,
      },
      {
        metric: 816,
        radius: 816,
        cat_color: null,
        position: [-122.4088144, 37.7912984],
        __timestamp: null,
      },
      {
        metric: 610,
        radius: 610,
        cat_color: null,
        position: [-122.3934248, 37.7776271],
        __timestamp: null,
      },
      {
        metric: 460,
        radius: 460,
        cat_color: null,
        position: [-122.390972, 37.789376],
        __timestamp: null,
      },
      {
        metric: 453,
        radius: 453,
        cat_color: null,
        position: [-122.3804676, 37.7334388],
        __timestamp: null,
      },
      {
        metric: 453,
        radius: 453,
        cat_color: null,
        position: [-122.4214063, 37.7813858],
        __timestamp: null,
      },
      {
        metric: 422,
        radius: 422,
        cat_color: null,
        position: [-122.3961419, 37.7905823],
        __timestamp: null,
      },
      {
        metric: 376,
        radius: 376,
        cat_color: null,
        position: [-122.3922757, 37.7858294],
        __timestamp: null,
      },
      {
        metric: 359,
        radius: 359,
        cat_color: null,
        position: [-122.3903881, 37.7826463],
        __timestamp: null,
      },
      {
        metric: 353,
        radius: 353,
        cat_color: null,
        position: [-122.3936422, 37.7870311],
        __timestamp: null,
      },
      {
        metric: 306,
        radius: 306,
        cat_color: null,
        position: [-122.435635, 37.7852314],
        __timestamp: null,
      },
      {
        metric: 301,
        radius: 301,
        cat_color: null,
        position: [-122.3971336, 37.7790975],
        __timestamp: null,
      },
      {
        metric: 300,
        radius: 300,
        cat_color: null,
        position: [-122.3921161, 37.7864536],
        __timestamp: null,
      },
      {
        metric: 292,
        radius: 292,
        cat_color: null,
        position: [-122.390611, 37.7876797],
        __timestamp: null,
      },
      {
        metric: 291,
        radius: 291,
        cat_color: null,
        position: [-122.4055041, 37.804244],
        __timestamp: null,
      },
      {
        metric: 264,
        radius: 264,
        cat_color: null,
        position: [-122.4136476, 37.7910263],
        __timestamp: null,
      },
      {
        metric: 247,
        radius: 247,
        cat_color: null,
        position: [-122.4224908, 37.7867552],
        __timestamp: null,
      },
    ],
    mapboxApiKey:
      'pk.eyJ1Ijoia3Jpc3R3IiwiYSI6ImNqbGg1N242NTFlczczdnBhazViMjgzZ2sifQ.lUneM-o3NucXN189EYyXxQ',
    metricLabels: ['count'],
  },
};
