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

import { ChartProps } from '@superset-ui/core';
import { supersetTheme } from '@apache-superset/core/ui';

jest.mock('supercluster', () => {
  const MockSupercluster = jest.fn().mockImplementation(() => ({
    load: jest.fn(),
    getClusters: jest.fn().mockReturnValue([]),
  }));
  return { __esModule: true, default: MockSupercluster };
});

// Import after mocking supercluster to avoid ESM parse error
// eslint-disable-next-line import/first
import transformProps from '../src/transformProps';

const baseFormData = {
  clusteringRadius: 60,
  globalOpacity: 0.8,
  mapboxColor: 'rgb(0, 139, 139)',
  mapboxStyle: 'mapbox://styles/mapbox/light-v9',
  pandasAggfunc: 'sum',
  pointRadiusUnit: 'Pixels',
  renderWhileDragging: true,
  viewportLongitude: -73.935242,
  viewportLatitude: 40.73061,
  viewportZoom: 9,
};

const baseQueriesData = [
  {
    data: {
      bounds: [
        [-74.0, 40.7],
        [-73.9, 40.8],
      ] as [[number, number], [number, number]],
      geoJSON: { features: [] },
      hasCustomMetric: false,
      mapboxApiKey: 'test-api-key',
    },
  },
];

function createChartProps(overrides: Record<string, unknown> = {}) {
  return new ChartProps({
    formData: { ...baseFormData, ...overrides },
    width: 800,
    height: 600,
    queriesData: baseQueriesData,
    theme: supersetTheme,
  });
}

test('extracts globalOpacity from formData', () => {
  const result = transformProps(createChartProps({ globalOpacity: 0.5 }));
  expect(result.globalOpacity).toBe(0.5);
});

test('extracts viewport values from formData', () => {
  const result = transformProps(
    createChartProps({
      viewportLongitude: -122.4,
      viewportLatitude: 37.8,
      viewportZoom: 12,
    }),
  );
  expect(result).toEqual(
    expect.objectContaining({
      viewportLongitude: -122.4,
      viewportLatitude: 37.8,
      viewportZoom: 12,
    }),
  );
});

test('provides onViewportChange callback that updates control values', () => {
  const setControlValue = jest.fn();
  const chartProps = new ChartProps({
    formData: baseFormData,
    width: 800,
    height: 600,
    queriesData: baseQueriesData,
    hooks: { setControlValue },
    theme: supersetTheme,
  });
  const result = transformProps(chartProps);
  expect(result.onViewportChange).toBeDefined();

  result.onViewportChange!({
    latitude: 51.5,
    longitude: -0.12,
    zoom: 10,
  });

  expect(setControlValue).toHaveBeenCalledWith('viewport_longitude', -0.12);
  expect(setControlValue).toHaveBeenCalledWith('viewport_latitude', 51.5);
  expect(setControlValue).toHaveBeenCalledWith('viewport_zoom', 10);
});

test('normalizes string viewport values to numbers', () => {
  const result = transformProps(
    createChartProps({
      viewportLongitude: '-122.4',
      viewportLatitude: '37.8',
      viewportZoom: '12',
    }),
  );
  expect(result.viewportLongitude).toBe(-122.4);
  expect(result.viewportLatitude).toBe(37.8);
  expect(result.viewportZoom).toBe(12);
});

test('normalizes empty viewport values to undefined', () => {
  const result = transformProps(
    createChartProps({
      viewportLongitude: '',
      viewportLatitude: '',
      viewportZoom: '',
    }),
  );
  expect(result.viewportLongitude).toBeUndefined();
  expect(result.viewportLatitude).toBeUndefined();
  expect(result.viewportZoom).toBeUndefined();
});

test('normalizes string opacity to number', () => {
  const result = transformProps(createChartProps({ globalOpacity: '0.5' }));
  expect(result.globalOpacity).toBe(0.5);
});

test('defaults empty opacity to 1', () => {
  const result = transformProps(createChartProps({ globalOpacity: '' }));
  expect(result.globalOpacity).toBe(1);
});

test('clamps opacity to [0, 1] range', () => {
  expect(
    transformProps(createChartProps({ globalOpacity: 5 })).globalOpacity,
  ).toBe(1);
  expect(
    transformProps(createChartProps({ globalOpacity: -1 })).globalOpacity,
  ).toBe(0);
});

test('passes through numeric values unchanged', () => {
  const result = transformProps(
    createChartProps({
      viewportLongitude: -122.4,
      viewportLatitude: 37.8,
      viewportZoom: 12,
      globalOpacity: 0.8,
    }),
  );
  expect(result.viewportLongitude).toBe(-122.4);
  expect(result.viewportLatitude).toBe(37.8);
  expect(result.viewportZoom).toBe(12);
  expect(result.globalOpacity).toBe(0.8);
});

test('calls onError and returns empty object for invalid color', () => {
  const onError = jest.fn();
  const chartProps = new ChartProps({
    formData: { ...baseFormData, mapboxColor: 'invalid-color' },
    width: 800,
    height: 600,
    queriesData: baseQueriesData,
    hooks: { onError },
    theme: supersetTheme,
  });
  const result = transformProps(chartProps);
  expect(onError).toHaveBeenCalledWith(
    "Color field must be of form 'rgb(%d, %d, %d)'",
  );
  expect(result).toEqual({});
});
