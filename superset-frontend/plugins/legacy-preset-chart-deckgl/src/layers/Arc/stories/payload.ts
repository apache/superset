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

// Payload data for Arc chart stories - US flight routes
export default {
  data: [
    // San Francisco to New York
    {
      LATITUDE: 37.7749,
      LONGITUDE: -122.4194,
      LATITUDE_DEST: 40.7128,
      LONGITUDE_DEST: -74.006,
      metric: 500,
    },
    // Los Angeles to Chicago
    {
      LATITUDE: 34.0522,
      LONGITUDE: -118.2437,
      LATITUDE_DEST: 41.8781,
      LONGITUDE_DEST: -87.6298,
      metric: 400,
    },
    // Seattle to Miami
    {
      LATITUDE: 47.6062,
      LONGITUDE: -122.3321,
      LATITUDE_DEST: 25.7617,
      LONGITUDE_DEST: -80.1918,
      metric: 300,
    },
    // Denver to Boston
    {
      LATITUDE: 39.7392,
      LONGITUDE: -104.9903,
      LATITUDE_DEST: 42.3601,
      LONGITUDE_DEST: -71.0589,
      metric: 250,
    },
    // Phoenix to Atlanta
    {
      LATITUDE: 33.4484,
      LONGITUDE: -112.074,
      LATITUDE_DEST: 33.749,
      LONGITUDE_DEST: -84.388,
      metric: 350,
    },
    // Dallas to Washington DC
    {
      LATITUDE: 32.7767,
      LONGITUDE: -96.797,
      LATITUDE_DEST: 38.9072,
      LONGITUDE_DEST: -77.0369,
      metric: 280,
    },
  ],
  colnames: [
    'LATITUDE',
    'LONGITUDE',
    'LATITUDE_DEST',
    'LONGITUDE_DEST',
    'metric',
  ],
  coltypes: [0, 0, 0, 0, 0],
};
