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
import type { ReactElement } from 'react';
import type { ControlPanelSectionConfig } from '@superset-ui/chart-controls';
// eslint-disable-next-line import/no-extraneous-dependencies
import { render } from '@testing-library/react';
import { SqlaFormData } from '@superset-ui/core';
import { supersetTheme, ThemeProvider } from '@apache-superset/core/theme';
import DeckGLGeoJson, {
  computeGeoJsonTextOptionsFromJsOutput,
  computeGeoJsonTextOptionsFromFormData,
  computeGeoJsonIconOptionsFromJsOutput,
  computeGeoJsonIconOptionsFromFormData,
  getPoints,
  getLayer,
} from './Geojson';
import controlPanel from './controlPanel';

const mockDeckGLContainerProps: Array<Record<string, unknown>> = [];

jest.mock('../../DeckGLContainer', () => ({
  DeckGLContainerStyledWrapper: (props: Record<string, unknown>) => {
    mockDeckGLContainerProps.push(props);
    const React = jest.requireActual('react');
    return React.createElement(
      'div',
      { 'data-testid': 'deckgl-container' },
      props.children,
    );
  },
}));

jest.mock('../../utils/mapbox', () => ({
  getMapboxApiKey: () => 'bootstrap-mapbox-key',
  hasMapboxApiKey: () => true,
}));

jest.mock('react-map-gl/maplibre', () => ({
  __esModule: true,
  Map: () => null,
  useControl: () => null,
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

test('controlPanel expands Map section so renderer controls are visible', () => {
  const mapSection = controlPanel.controlPanelSections.find(
    (
      section: ControlPanelSectionConfig | null,
    ): section is ControlPanelSectionConfig =>
      section !== null && section.label === 'Map',
  );

  expect(mapSection).toBeDefined();
  expect(mapSection?.expanded).toBe(true);
});

test('getPoints skips malformed GeoJSON entries instead of throwing', () => {
  const features = [
    {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [1, 2] },
      properties: {},
    },
    [[0, 0]],
    null,
  ] as unknown as Parameters<typeof getPoints>[0];

  expect(getPoints(features)).toEqual([
    [1, 2],
    [1, 2],
  ]);
  expect(getPoints()).toEqual([]);
});

const renderWithTheme = (component: ReactElement) =>
  render(<ThemeProvider theme={supersetTheme}>{component}</ThemeProvider>);

const geoJsonProps = {
  formData: {
    datasource: 'test_datasource',
    viz_type: 'deck_geojson',
    slice_id: 1,
    autozoom: false,
    map_style: 'legacy-map-style',
    extruded: false,
    filled: true,
    stroked: true,
    line_width: 1,
    line_width_unit: 'pixels',
    point_radius_scale: 1,
    enable_labels: false,
    enable_icons: false,
  },
  payload: {
    data: {
      features: [
        {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [0, 0] },
          properties: { name: 'Test point' },
        },
      ],
    },
  },
  setControlValue: jest.fn(),
  viewport: { longitude: 0, latitude: 0, zoom: 1 },
  onAddFilter: jest.fn(),
  height: 600,
  width: 800,
  filterState: {},
  onContextMenu: jest.fn(),
  setDataMask: jest.fn(),
  emitCrossFilters: false,
};

const lastDeckGLContainerProps = () =>
  mockDeckGLContainerProps
    .slice()
    .reverse()
    .find(props => props?.viewport !== undefined);

test('DeckGLGeoJson passes selected MapLibre renderer props to the container', () => {
  mockDeckGLContainerProps.length = 0;

  renderWithTheme(
    <DeckGLGeoJson
      {...geoJsonProps}
      formData={{
        ...geoJsonProps.formData,
        map_renderer: 'maplibre',
        maplibre_style: 'https://example.com/maplibre-style.json',
        mapbox_style: 'mapbox://styles/mapbox/dark-v9',
      }}
    />,
  );

  expect(lastDeckGLContainerProps()).toEqual(
    expect.objectContaining({
      mapProvider: 'maplibre',
      mapStyle: 'https://example.com/maplibre-style.json',
      mapboxApiKey: 'bootstrap-mapbox-key',
    }),
  );
});

test('DeckGLGeoJson passes selected Mapbox renderer props to the container', () => {
  mockDeckGLContainerProps.length = 0;

  renderWithTheme(
    <DeckGLGeoJson
      {...geoJsonProps}
      formData={{
        ...geoJsonProps.formData,
        map_renderer: 'mapbox',
        maplibre_style: 'https://example.com/maplibre-style.json',
        mapbox_style: 'mapbox://styles/mapbox/satellite-v9',
      }}
    />,
  );

  expect(lastDeckGLContainerProps()).toEqual(
    expect.objectContaining({
      mapProvider: 'mapbox',
      mapStyle: 'mapbox://styles/mapbox/satellite-v9',
      mapboxApiKey: 'bootstrap-mapbox-key',
    }),
  );
});

test('DeckGLGeoJson falls back to legacy map_style when provider-specific style is absent', () => {
  mockDeckGLContainerProps.length = 0;

  renderWithTheme(
    <DeckGLGeoJson
      {...geoJsonProps}
      formData={{
        ...geoJsonProps.formData,
        map_renderer: 'maplibre',
        maplibre_style: undefined,
        map_style: 'legacy-map-style',
      }}
    />,
  );

  expect(lastDeckGLContainerProps()).toEqual(
    expect.objectContaining({
      mapProvider: 'maplibre',
      mapStyle: 'legacy-map-style',
      mapboxApiKey: 'bootstrap-mapbox-key',
    }),
  );
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
