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

import { ChartProps, DatasourceType } from '@superset-ui/core';
import { supersetTheme } from '@apache-superset/core/ui';
import transformProps, { FormData } from '../src/transformProps';

jest.mock('supercluster', () => ({
  __esModule: true,
  default: class Supercluster {
    load() {
      return this;
    }
  },
}));

const createMockChartProps = (
  overrides: Partial<ChartProps<FormData>> = {},
): ChartProps<FormData> => {
  const {
    formData: formDataOverrides,
    queriesData: queriesDataOverrides,
    hooks: hooksOverrides,
    ...restOverrides
  } = overrides;
  return {
    annotationData: {},
    initialValues: {},
    ownState: {},
    filterState: {},
    behaviors: [],
    theme: supersetTheme,
    width: 800,
    height: 600,
    datasource: {
      id: 1,
      name: 'test_table',
      type: DatasourceType.Table,
      columns: [],
      metrics: [],
      columnFormats: {},
      verboseMap: {},
    },
    rawDatasource: {},
    rawFormData: {
      clusteringRadius: 60,
      globalOpacity: 1,
      mapboxColor: 'rgb(0, 0, 0)',
      mapboxStyle: 'mapbox://styles/mapbox/streets-v11',
      pandasAggfunc: 'sum',
      pointRadius: 60,
      pointRadiusUnit: 'Pixels',
      renderWhileDragging: true,
    },
    hooks: {
      onError: jest.fn(),
      setControlValue: jest.fn(),
      ...hooksOverrides,
    },
    formData: {
      clusteringRadius: 60,
      globalOpacity: 1,
      mapboxColor: 'rgb(0, 0, 0)',
      mapboxStyle: 'mapbox://styles/mapbox/streets-v11',
      pandasAggfunc: 'sum',
      pointRadius: 60,
      pointRadiusUnit: 'Pixels',
      renderWhileDragging: true,
      ...formDataOverrides,
    },
    queriesData: [
      {
        data: {
          bounds: [
            [-122.5, 37.5],
            [-122.0, 38.0],
          ] as [[number, number], [number, number]],
          geoJSON: {
            type: 'FeatureCollection',
            features: [],
          },
          hasCustomMetric: false,
          mapboxApiKey: 'test-api-key',
          ...queriesDataOverrides?.[0]?.data,
        },
        colnames: [],
        coltypes: [],
        rowcount: 0,
        ...queriesDataOverrides?.[0],
      },
    ],
    ...restOverrides,
  };
};

test('parses valid RGB color and returns tuple of [number, number, number, number]', () => {
  const props = createMockChartProps({
    formData: {
      mapboxColor: 'rgb(255, 128, 64)',
    },
  });

  const result = transformProps(props);

  expect(result.rgb).toEqual([255, 128, 64, 255]);
  expect(Array.isArray(result.rgb)).toBe(true);
  expect(result.rgb?.length).toBe(4);
  expect(typeof result.rgb?.[0]).toBe('number');
  expect(typeof result.rgb?.[1]).toBe('number');
  expect(typeof result.rgb?.[2]).toBe('number');
  expect(typeof result.rgb?.[3]).toBe('number');
});

test('handles RGB color with spaces correctly', () => {
  const props = createMockChartProps({
    formData: {
      mapboxColor: 'rgb(255,   128,   64)',
    },
  });

  const result = transformProps(props);

  expect(result.rgb).toEqual([255, 128, 64, 255]);
});

test('handles RGB color without spaces', () => {
  const props = createMockChartProps({
    formData: {
      mapboxColor: 'rgb(255,128,64)',
    },
  });

  const result = transformProps(props);

  expect(result.rgb).toEqual([255, 128, 64, 255]);
});

test('calls onError and returns default values for invalid RGB format', () => {
  const onError = jest.fn();
  const props = createMockChartProps({
    hooks: {
      onError,
      setControlValue: jest.fn(),
    },
    formData: {
      mapboxColor: 'invalid-color',
    },
  });

  const result = transformProps(props);

  expect(onError).toHaveBeenCalledWith(
    "Color field must be of form 'rgb(%d, %d, %d)'",
  );
  expect(result.rgb).toEqual([128, 128, 128, 255]);
  expect(result.clusterer).toBeDefined();
  expect(result.hasCustomMetric).toBe(false);
});

test('calls onError for hex color format', () => {
  const onError = jest.fn();
  const props = createMockChartProps({
    hooks: {
      onError,
      setControlValue: jest.fn(),
    },
    formData: {
      mapboxColor: '#ff8040',
    },
  });

  const result = transformProps(props);

  expect(onError).toHaveBeenCalledWith(
    "Color field must be of form 'rgb(%d, %d, %d)'",
  );
  expect(result.rgb).toEqual([128, 128, 128, 255]);
  expect(result.clusterer).toBeDefined();
  expect(result.hasCustomMetric).toBe(false);
});

test('calls onError for rgba format', () => {
  const onError = jest.fn();
  const props = createMockChartProps({
    hooks: {
      onError,
      setControlValue: jest.fn(),
    },
    formData: {
      mapboxColor: 'rgba(255, 128, 64, 0.5)',
    },
  });

  const result = transformProps(props);

  expect(onError).toHaveBeenCalledWith(
    "Color field must be of form 'rgb(%d, %d, %d)'",
  );
  expect(result.rgb).toEqual([128, 128, 128, 255]);
  expect(result.clusterer).toBeDefined();
  expect(result.hasCustomMetric).toBe(false);
});

test('returns clusterer with custom metric options when hasCustomMetric is true', () => {
  const props = createMockChartProps({
    queriesData: [
      {
        data: {
          hasCustomMetric: true,
          bounds: [
            [-122.5, 37.5],
            [-122.0, 38.0],
          ],
          geoJSON: { type: 'FeatureCollection', features: [] },
          mapboxApiKey: 'test-key',
        },
      },
    ],
  });

  const result = transformProps(props);

  expect(result.clusterer).toBeDefined();
  expect(result.hasCustomMetric).toBe(true);
});

test('returns clusterer without custom metric options when hasCustomMetric is false', () => {
  const props = createMockChartProps({
    queriesData: [
      {
        data: {
          hasCustomMetric: false,
          bounds: [
            [-122.5, 37.5],
            [-122.0, 38.0],
          ],
          geoJSON: { type: 'FeatureCollection', features: [] },
          mapboxApiKey: 'test-key',
        },
      },
    ],
  });

  const result = transformProps(props);

  expect(result.clusterer).toBeDefined();
  expect(result.hasCustomMetric).toBe(false);
});

test('handles "Auto" point radius by converting to DEFAULT_POINT_RADIUS', () => {
  const props = createMockChartProps({
    formData: {
      pointRadius: 'Auto',
    },
  });

  const result = transformProps(props);

  expect(result.pointRadius).toBe(60);
  expect(typeof result.pointRadius).toBe('number');
});

test('handles numeric point radius as string', () => {
  const props = createMockChartProps({
    formData: {
      pointRadius: '100',
    },
  });

  const result = transformProps(props);

  expect(result.pointRadius).toBe(100);
  expect(typeof result.pointRadius).toBe('number');
});

test('handles numeric point radius as number', () => {
  const props = createMockChartProps({
    formData: {
      pointRadius: 100,
    },
  });

  const result = transformProps(props);

  expect(result.pointRadius).toBe(100);
});

test('sets up onViewportChange to call setControlValue', () => {
  const setControlValue = jest.fn();
  const props = createMockChartProps({
    hooks: {
      onError: jest.fn(),
      setControlValue,
    },
  });

  const result = transformProps(props);

  result.onViewportChange?.({
    latitude: 37.7749,
    longitude: -122.4194,
    zoom: 12,
  });

  expect(setControlValue).toHaveBeenCalledWith('viewport_longitude', -122.4194);
  expect(setControlValue).toHaveBeenCalledWith('viewport_latitude', 37.7749);
  expect(setControlValue).toHaveBeenCalledWith('viewport_zoom', 12);
});

test('passes through width and height', () => {
  const props = createMockChartProps({
    width: 1000,
    height: 800,
  });

  const result = transformProps(props);

  expect(result.width).toBe(1000);
  expect(result.height).toBe(800);
});

test('passes through globalOpacity', () => {
  const props = createMockChartProps({
    formData: {
      globalOpacity: 0.7,
    },
  });

  const result = transformProps(props);

  expect(result.globalOpacity).toBe(0.7);
});

test('passes through renderWhileDragging', () => {
  const props = createMockChartProps({
    formData: {
      renderWhileDragging: false,
    },
  });

  const result = transformProps(props);

  expect(result.renderWhileDragging).toBe(false);
});

test('passes through mapboxApiKey', () => {
  const props = createMockChartProps({
    queriesData: [
      {
        data: {
          mapboxApiKey: 'custom-api-key',
          bounds: [
            [-122.5, 37.5],
            [-122.0, 38.0],
          ],
          geoJSON: { type: 'FeatureCollection', features: [] },
          hasCustomMetric: false,
        },
      },
    ],
  });

  const result = transformProps(props);

  expect(result.mapboxApiKey).toBe('custom-api-key');
});

test('passes through aggregatorName from pandasAggfunc', () => {
  const props = createMockChartProps({
    formData: {
      pandasAggfunc: 'mean',
    },
  });

  const result = transformProps(props);

  expect(result.aggregatorName).toBe('mean');
});

test('passes through pointRadiusUnit', () => {
  const props = createMockChartProps({
    formData: {
      pointRadiusUnit: 'Kilometers',
    },
  });

  const result = transformProps(props);

  expect(result.pointRadiusUnit).toBe('Kilometers');
});

test('handles valid RGB values at edge of valid range', () => {
  const props = createMockChartProps({
    formData: {
      mapboxColor: 'rgb(0, 0, 0)',
    },
  });

  const result = transformProps(props);

  expect(result.rgb).toEqual([0, 0, 0, 255]);
});

test('handles valid RGB values at maximum valid range', () => {
  const props = createMockChartProps({
    formData: {
      mapboxColor: 'rgb(255, 255, 255)',
    },
  });

  const result = transformProps(props);

  expect(result.rgb).toEqual([255, 255, 255, 255]);
});

test('accepts RGB values exceeding 255 (regex only validates format)', () => {
  const props = createMockChartProps({
    formData: {
      mapboxColor: 'rgb(256, 256, 256)',
    },
  });

  const result = transformProps(props);

  expect(result.rgb).toEqual([256, 256, 256, 255]);
});

test('passes through mapStyle from mapboxStyle', () => {
  const props = createMockChartProps({
    formData: {
      mapboxStyle: 'mapbox://styles/mapbox/dark-v10',
    },
  });

  const result = transformProps(props);

  expect(result.mapStyle).toBe('mapbox://styles/mapbox/dark-v10');
});

test('passes through bounds', () => {
  const bounds: [[number, number], [number, number]] = [
    [-122.5, 37.5],
    [-122.0, 38.0],
  ];
  const props = createMockChartProps({
    queriesData: [
      {
        data: {
          bounds,
          geoJSON: { type: 'FeatureCollection', features: [] },
          mapboxApiKey: 'test-key',
          hasCustomMetric: false,
        },
      },
    ],
  });

  const result = transformProps(props);

  expect(result.bounds).toEqual(bounds);
});
