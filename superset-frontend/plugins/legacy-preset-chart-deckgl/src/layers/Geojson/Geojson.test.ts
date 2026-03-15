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
import { SqlaFormData } from '@superset-ui/core';
import {
  computeGeoJsonTextOptionsFromJsOutput,
  computeGeoJsonTextOptionsFromFormData,
  computeGeoJsonIconOptionsFromJsOutput,
  computeGeoJsonIconOptionsFromFormData,
  getLayer,
} from './Geojson';

jest.mock('@deck.gl/react', () => ({
  __esModule: true,
  default: () => null,
}));

test('computeGeoJsonTextOptionsFromJsOutput returns an empty object for non-object input', () => {
  expect(computeGeoJsonTextOptionsFromJsOutput(null)).toEqual({});
  expect(computeGeoJsonTextOptionsFromJsOutput(42)).toEqual({});
  expect(computeGeoJsonTextOptionsFromJsOutput([1, 2, 3])).toEqual({});
  expect(computeGeoJsonTextOptionsFromJsOutput('string')).toEqual({});
});

test('computeGeoJsonTextOptionsFromJsOutput extracts valid text options from the input object', () => {
  const input = {
    getText: 'name',
    getTextColor: [1, 2, 3, 255],
    invalidOption: true,
  };
  const expectedOutput = {
    getText: 'name',
    getTextColor: [1, 2, 3, 255],
  };
  expect(computeGeoJsonTextOptionsFromJsOutput(input)).toEqual(expectedOutput);
});

test('computeGeoJsonTextOptionsFromFormData computes text options based on form data', () => {
  const formData: SqlaFormData = {
    label_property_name: 'name',
    label_color: { r: 1, g: 2, b: 3, a: 1 },
    label_size: 123,
    label_size_unit: 'pixels',
    datasource: 'test_datasource',
    viz_type: 'deck_geojson',
  };

  const expectedOutput = {
    getText: expect.any(Function),
    getTextColor: [1, 2, 3, 255],
    getTextSize: 123,
    textSizeUnits: 'pixels',
  };

  const actualOutput = computeGeoJsonTextOptionsFromFormData(formData);
  expect(actualOutput).toEqual(expectedOutput);

  const sampleFeature = { properties: { name: 'Test' } };
  expect(actualOutput.getText(sampleFeature)).toBe('Test');
});

test('computeGeoJsonIconOptionsFromJsOutput returns an empty object for non-object input', () => {
  expect(computeGeoJsonIconOptionsFromJsOutput(null)).toEqual({});
  expect(computeGeoJsonIconOptionsFromJsOutput(42)).toEqual({});
  expect(computeGeoJsonIconOptionsFromJsOutput([1, 2, 3])).toEqual({});
  expect(computeGeoJsonIconOptionsFromJsOutput('string')).toEqual({});
});

test('computeGeoJsonIconOptionsFromJsOutput extracts valid icon options from the input object', () => {
  const input = {
    getIcon: 'icon_name',
    getIconColor: [1, 2, 3, 255],
    invalidOption: false,
  };

  const expectedOutput = {
    getIcon: 'icon_name',
    getIconColor: [1, 2, 3, 255],
  };

  expect(computeGeoJsonIconOptionsFromJsOutput(input)).toEqual(expectedOutput);
});

test('computeGeoJsonIconOptionsFromFormData computes icon options based on form data', () => {
  const formData: SqlaFormData = {
    icon_url: 'https://example.com/icon.png',
    icon_size: 123,
    icon_size_unit: 'pixels',
    datasource: 'test_datasource',
    viz_type: 'deck_geojson',
  };

  const expectedOutput = {
    getIcon: expect.any(Function),
    getIconSize: 123,
    iconSizeUnits: 'pixels',
  };

  const actualOutput = computeGeoJsonIconOptionsFromFormData(formData);
  expect(actualOutput).toEqual(expectedOutput);

  expect(actualOutput.getIcon()).toEqual({
    url: 'https://example.com/icon.png',
    height: 128,
    width: 128,
  });
});

const baseFormData: SqlaFormData = {
  datasource: 'test_datasource',
  viz_type: 'deck_geojson',
  slice_id: 1,
  fill_color_picker: { r: 0, g: 0, b: 255, a: 1 },
  stroke_color_picker: { r: 0, g: 0, b: 0, a: 1 },
};

const baseLayerArgs = {
  onContextMenu: jest.fn(),
  filterState: undefined,
  setDataMask: jest.fn(),
  payload: { data: { type: 'FeatureCollection', features: [] } },
  setTooltip: jest.fn(),
  emitCrossFilters: false,
};

test('getLayer preserves rendering for existing charts without new point radius fields', () => {
  // Simulate form data from an existing chart that only has point_radius_scale
  const legacyFormData = {
    ...baseFormData,
    point_radius_scale: 200,
    // point_radius and point_radius_units intentionally absent
  };

  const layer = getLayer({ formData: legacyFormData, ...baseLayerArgs });
  const { props } = layer;

  // Should match deck.gl defaults, NOT the new control panel defaults
  expect(props.getPointRadius).toBe(1); // deck.gl default, not 10
  expect(props.pointRadiusUnits).toBe('meters'); // deck.gl default, not 'pixels'
  expect(props.pointRadiusScale).toBe(200); // user's saved value preserved
});

test('getLayer uses control panel defaults for new charts', () => {
  const newChartFormData = {
    ...baseFormData,
    point_radius: 10,
    point_radius_units: 'pixels',
    point_radius_scale: 1,
  };

  const layer = getLayer({ formData: newChartFormData, ...baseLayerArgs });
  const { props } = layer;

  expect(props.getPointRadius).toBe(10);
  expect(props.pointRadiusUnits).toBe('pixels');
  expect(props.pointRadiusScale).toBe(1);
});
