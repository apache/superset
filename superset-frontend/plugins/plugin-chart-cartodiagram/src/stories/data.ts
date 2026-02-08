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

// Sample GeoJSON Points representing cities with chart data
export const sampleGeoJsonPoints = {
  type: 'FeatureCollection' as const,
  features: [
    {
      type: 'Feature' as const,
      properties: {
        name: 'San Francisco',
        population: 883305,
        revenue: 2500000,
        expenses: 1800000,
      },
      geometry: {
        type: 'Point' as const,
        coordinates: [-122.4194, 37.7749],
      },
    },
    {
      type: 'Feature' as const,
      properties: {
        name: 'Los Angeles',
        population: 3979576,
        revenue: 8500000,
        expenses: 6200000,
      },
      geometry: {
        type: 'Point' as const,
        coordinates: [-118.2437, 34.0522],
      },
    },
    {
      type: 'Feature' as const,
      properties: {
        name: 'San Diego',
        population: 1423851,
        revenue: 4200000,
        expenses: 3100000,
      },
      geometry: {
        type: 'Point' as const,
        coordinates: [-117.1611, 32.7157],
      },
    },
    {
      type: 'Feature' as const,
      properties: {
        name: 'San Jose',
        population: 1021795,
        revenue: 5800000,
        expenses: 4000000,
      },
      geometry: {
        type: 'Point' as const,
        coordinates: [-121.8863, 37.3382],
      },
    },
    {
      type: 'Feature' as const,
      properties: {
        name: 'Sacramento',
        population: 524943,
        revenue: 1800000,
        expenses: 1500000,
      },
      geometry: {
        type: 'Point' as const,
        coordinates: [-121.4944, 38.5816],
      },
    },
  ],
};

// Sample data formatted for the chart (with geom column)
export const sampleChartData = [
  {
    geom: '{"type":"Point","coordinates":[-122.4194,37.7749]}',
    name: 'San Francisco',
    category: 'Technology',
    value: 1500000,
  },
  {
    geom: '{"type":"Point","coordinates":[-122.4194,37.7749]}',
    name: 'San Francisco',
    category: 'Finance',
    value: 800000,
  },
  {
    geom: '{"type":"Point","coordinates":[-122.4194,37.7749]}',
    name: 'San Francisco',
    category: 'Healthcare',
    value: 200000,
  },
  {
    geom: '{"type":"Point","coordinates":[-118.2437,34.0522]}',
    name: 'Los Angeles',
    category: 'Entertainment',
    value: 3500000,
  },
  {
    geom: '{"type":"Point","coordinates":[-118.2437,34.0522]}',
    name: 'Los Angeles',
    category: 'Technology',
    value: 2000000,
  },
  {
    geom: '{"type":"Point","coordinates":[-118.2437,34.0522]}',
    name: 'Los Angeles',
    category: 'Finance',
    value: 3000000,
  },
  {
    geom: '{"type":"Point","coordinates":[-117.1611,32.7157]}',
    name: 'San Diego',
    category: 'Tourism',
    value: 2200000,
  },
  {
    geom: '{"type":"Point","coordinates":[-117.1611,32.7157]}',
    name: 'San Diego',
    category: 'Defense',
    value: 2000000,
  },
  {
    geom: '{"type":"Point","coordinates":[-121.8863,37.3382]}',
    name: 'San Jose',
    category: 'Technology',
    value: 4500000,
  },
  {
    geom: '{"type":"Point","coordinates":[-121.8863,37.3382]}',
    name: 'San Jose',
    category: 'Hardware',
    value: 1300000,
  },
];

// Sample payload for the chart
export const samplePayload = {
  data: sampleChartData,
  colnames: ['geom', 'name', 'category', 'value'],
  coltypes: [1, 1, 1, 0],
};

// Default layer configuration using OpenStreetMap tiles
export const defaultLayerConfigs = [
  {
    type: 'XYZ' as const,
    title: 'OpenStreetMap',
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  },
];

// Default map view centered on California
export const defaultMapView = {
  mode: 'FIT_DATA' as const,
  zoom: 6,
  latitude: 36.7783,
  longitude: -119.4179,
  fixedZoom: 6,
  fixedLatitude: 36.7783,
  fixedLongitude: -119.4179,
};

// Default chart size configuration
export const defaultChartSize = {
  type: 'FIXED' as const,
  configs: {
    zoom: 6,
    width: 100,
    height: 100,
  },
  values: {
    6: { width: 100, height: 100 },
    7: { width: 120, height: 120 },
    8: { width: 140, height: 140 },
  },
};

// Default chart background color
export const defaultChartBackgroundColor = {
  r: 255,
  g: 255,
  b: 255,
  a: 0.9,
};
