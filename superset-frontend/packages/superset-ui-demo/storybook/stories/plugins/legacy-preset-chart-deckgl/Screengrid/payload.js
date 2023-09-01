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
    granularity_sqla: 'dttm',
    grid_size: 20,
    groupby: [],
    mapbox_style: 'mapbox://styles/mapbox/dark-v9',
    point_radius: 'Auto',
    point_radius_fixed: { type: 'fix', value: 2000 },
    point_unit: 'square_m',
    row_limit: 5000,
    size: 'count',
    spatial: { latCol: 'LAT', lonCol: 'LON', type: 'latlong' },
    time_grain_sqla: null,
    viewport: {
      bearing: -4.952916738791771,
      latitude: 37.76024135844065,
      longitude: -122.41827069521386,
      pitch: 4.750411100577438,
      zoom: 14.161641703941438,
    },
    viz_type: 'deck_screengrid',
    slice_id: 67,
    time_range: ' : ',
    adhoc_filters: [
      {
        clause: 'WHERE',
        expressionType: 'SIMPLE',
        filterOptionName: '341bf332-81fe-4f9e-837e-90a4d8b8b9f0',
        comparator: '',
        operator: 'IS NOT NULL',
        subject: 'LAT',
      },
      {
        clause: 'WHERE',
        expressionType: 'SIMPLE',
        filterOptionName: '453dd738-e394-4ea2-bbe9-a7b59bf5e0cc',
        comparator: '',
        operator: 'IS NOT NULL',
        subject: 'LON',
      },
    ],
    where: '',
    having: '',
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
      { position: [-122.4221936, 37.7786083], weight: 2415, __timestamp: null },
      { position: [-122.4101989, 37.7878771], weight: 2391, __timestamp: null },
      { position: [-122.4205965, 37.8054735], weight: 1349, __timestamp: null },
      { position: [-122.4125137, 37.7908413], weight: 1004, __timestamp: null },
      { position: [-122.4088144, 37.7912984], weight: 816, __timestamp: null },
      { position: [-122.3934248, 37.7776271], weight: 610, __timestamp: null },
      { position: [-122.390972, 37.789376], weight: 460, __timestamp: null },
      { position: [-122.3804676, 37.7334388], weight: 453, __timestamp: null },
      { position: [-122.4214063, 37.7813858], weight: 453, __timestamp: null },
      { position: [-122.3961419, 37.7905823], weight: 422, __timestamp: null },
      { position: [-122.3922757, 37.7858294], weight: 376, __timestamp: null },
      { position: [-122.3903881, 37.7826463], weight: 359, __timestamp: null },
      { position: [-122.3936422, 37.7870311], weight: 353, __timestamp: null },
      { position: [-122.435635, 37.7852314], weight: 306, __timestamp: null },
      { position: [-122.3971336, 37.7790975], weight: 301, __timestamp: null },
      { position: [-122.3921161, 37.7864536], weight: 300, __timestamp: null },
      { position: [-122.390611, 37.7876797], weight: 292, __timestamp: null },
      { position: [-122.4055041, 37.804244], weight: 291, __timestamp: null },
      { position: [-122.4136476, 37.7910263], weight: 264, __timestamp: null },
      { position: [-122.4224908, 37.7867552], weight: 247, __timestamp: null },
      { position: [-122.4123203, 37.7784493], weight: 240, __timestamp: null },
      { position: [-122.4368896, 37.7822303], weight: 239, __timestamp: null },
      { position: [-122.389625, 37.7806302], weight: 237, __timestamp: null },
      { position: [-122.3990823, 37.7831803], weight: 237, __timestamp: null },
      { position: [-122.3959614, 37.7740032], weight: 219, __timestamp: null },
      { position: [-122.4041783, 37.8044503], weight: 216, __timestamp: null },
      { position: [-122.4005582, 37.7706919], weight: 210, __timestamp: null },
      { position: [-122.4040784, 37.8034687], weight: 209, __timestamp: null },
      { position: [-122.418513, 37.7717131], weight: 208, __timestamp: null },
      { position: [-122.4127266, 37.7899451], weight: 202, __timestamp: null },
      { position: [-122.402292, 37.7808479], weight: 201, __timestamp: null },
      { position: [-122.391326, 37.7892785], weight: 200, __timestamp: null },
      { position: [-122.3882041, 37.7195347], weight: 198, __timestamp: null },
      { position: [-122.3917766, 37.7876762], weight: 197, __timestamp: null },
      { position: [-122.4151204, 37.78524], weight: 196, __timestamp: null },
      { position: [-122.3902944, 37.7836002], weight: 191, __timestamp: null },
      { position: [-122.4162567, 37.775248], weight: 190, __timestamp: null },
      { position: [-122.404391, 37.7853957], weight: 190, __timestamp: null },
      { position: [-122.479301, 37.7269377], weight: 180, __timestamp: null },
      { position: [-122.396631, 37.7536653], weight: 176, __timestamp: null },
      { position: [-122.3990994, 37.7866056], weight: 175, __timestamp: null },
      { position: [-122.3990304, 37.7857742], weight: 166, __timestamp: null },
      { position: [-122.4032414, 37.7640112], weight: 165, __timestamp: null },
      { position: [-122.4242026, 37.7867158], weight: 165, __timestamp: null },
      { position: [-122.4258311, 37.7863612], weight: 164, __timestamp: null },
      { position: [-122.4125675, 37.7903477], weight: 161, __timestamp: null },
    ],
    mapboxApiKey:
      'pk.eyJ1Ijoia3Jpc3R3IiwiYSI6ImNqbGg1N242NTFlczczdnBhazViMjgzZ2sifQ.lUneM-o3NucXN189EYyXxQ',
    metricLabels: ['count'],
  },
};
