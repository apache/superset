/**
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

const coord1 = '[1,2]';
const coord2 = '[3,4]';
export const geom1 = `{"type":"Point","coordinates":${coord1}}`;
export const geom2 = `{"type":"Point","coordinates":${coord2}}`;

export const nonTimeSeriesChartData: any = [
  {
    geom: geom1,
    my_value: 'apple',
    my_count: 347,
  },
  {
    geom: geom1,
    my_value: 'apple',
    my_count: 360,
  },
  {
    geom: geom1,
    my_value: 'lemon',
    my_count: 335,
  },
  {
    geom: geom1,
    my_value: 'lemon',
    my_count: 333,
  },
  {
    geom: geom1,
    my_value: 'lemon',
    my_count: 353,
  },
  {
    geom: geom1,
    my_value: 'lemon',
    my_count: 359,
  },
  {
    geom: geom2,
    my_value: 'lemon',
    my_count: 347,
  },
  {
    geom: geom2,
    my_value: 'apple',
    my_count: 335,
  },
  {
    geom: geom2,
    my_value: 'apple',
    my_count: 356,
  },
  {
    geom: geom2,
    my_value: 'banana',
    my_count: 218,
  },
];

export const timeseriesChartData = [
  {
    [geom1]: 347,
    [geom2]: 360,
    mydate: 1564275000000,
  },
  {
    [geom1]: 353,
    [geom2]: 328,
    mydate: 1564272000000,
  },
];

export const groupedTimeseriesChartData = [
  {
    [`${geom1}, apple`]: 347,
    [`${geom2}, apple`]: 360,
    [`${geom1}, lemon`]: 352,
    [`${geom2}, lemon`]: 364,
    mydate: 1564275000000,
  },
  {
    [`${geom1}, apple`]: 353,
    [`${geom2}, apple`]: 328,
    [`${geom1}, lemon`]: 346,
    [`${geom2}, lemon`]: 333,
    mydate: 1564272000000,
  },
];

export const groupedTimeseriesLabelMap = {
  [`${geom1}, apple`]: [geom1, 'apple'],
  [`${geom2}, apple`]: [geom2, 'apple'],
  [`${geom1}, lemon`]: [geom1, 'lemon'],
  [`${geom2}, lemon`]: [geom2, 'lemon'],
};
