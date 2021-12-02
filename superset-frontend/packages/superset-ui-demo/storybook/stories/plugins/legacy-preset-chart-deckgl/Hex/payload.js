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
    color_picker: { a: 1, b: 0, g: 255, r: 14 },
    datasource: '5__table',
    extruded: true,
    granularity_sqla: 'dttm',
    grid_size: 120,
    groupby: [],
    mapbox_style: 'mapbox://styles/mapbox/satellite-streets-v9',
    point_radius: 'Auto',
    point_radius_fixed: { type: 'fix', value: 2000 },
    point_radius_unit: 'Pixels',
    row_limit: 5000,
    size: 'count',
    spatial: { latCol: 'LAT', lonCol: 'LON', type: 'latlong' },
    time_grain_sqla: null,
    viewport: {
      bearing: 155.80099696026355,
      latitude: 37.7942314882596,
      longitude: -122.42066918995666,
      pitch: 53.470800300695146,
      zoom: 12.699690845482069,
    },
    viz_type: 'deck_grid',
    slice_id: 69,
    time_range: ' : ',
    adhoc_filters: [
      {
        clause: 'WHERE',
        expressionType: 'SIMPLE',
        filterOptionName: '72912258-6f4f-4f04-a570-58317ca49b11',
        comparator: '',
        operator: 'IS NOT NULL',
        subject: 'LAT',
      },
      {
        clause: 'WHERE',
        expressionType: 'SIMPLE',
        filterOptionName: '7e19669b-48ef-4be8-a7e1-8378dedb4c00',
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
      { position: [-122.4221936, 37.7786083], weight: 2415 },
      { position: [-122.4101989, 37.7878771], weight: 2391 },
      { position: [-122.4205965, 37.8054735], weight: 1349 },
      { position: [-122.4125137, 37.7908413], weight: 1004 },
      { position: [-122.4088144, 37.7912984], weight: 816 },
      { position: [-122.3934248, 37.7776271], weight: 610 },
      { position: [-122.390972, 37.789376], weight: 460 },
      { position: [-122.3804676, 37.7334388], weight: 453 },
      { position: [-122.4214063, 37.7813858], weight: 453 },
      { position: [-122.3961419, 37.7905823], weight: 422 },
      { position: [-122.3922757, 37.7858294], weight: 376 },
      { position: [-122.3903881, 37.7826463], weight: 359 },
      { position: [-122.3936422, 37.7870311], weight: 353 },
      { position: [-122.435635, 37.7852314], weight: 306 },
      { position: [-122.3971336, 37.7790975], weight: 301 },
      { position: [-122.3921161, 37.7864536], weight: 300 },
      { position: [-122.390611, 37.7876797], weight: 292 },
      { position: [-122.4055041, 37.804244], weight: 291 },
      { position: [-122.4136476, 37.7910263], weight: 264 },
      { position: [-122.4224908, 37.7867552], weight: 247 },
      { position: [-122.4123203, 37.7784493], weight: 240 },
      { position: [-122.4368896, 37.7822303], weight: 239 },
      { position: [-122.389625, 37.7806302], weight: 237 },
    ],
    mapboxApiKey:
      'pk.eyJ1Ijoia3Jpc3R3IiwiYSI6ImNqbGg1N242NTFlczczdnBhazViMjgzZ2sifQ.lUneM-o3NucXN189EYyXxQ',
    metricLabels: ['count'],
  },
};
