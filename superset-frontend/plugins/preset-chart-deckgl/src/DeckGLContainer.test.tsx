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

import { ComponentProps, createRef, ReactNode } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import type { Layer } from '@deck.gl/core';
import { supersetTheme, ThemeProvider } from '@apache-superset/core/theme';
import {
  OSM_TILE_ATTRIBUTION,
  OSM_TILE_STYLE_URL,
} from '@superset-ui/core/utils/mapStyles';
import mapboxgl from 'mapbox-gl';
import { DeckGLContainer, DeckGLContainerHandle } from './DeckGLContainer';

jest.mock('react-map-gl/maplibre', () => ({
  Map: ({
    children,
    mapStyle,
    onMove,
  }: {
    children: ReactNode;
    mapStyle: unknown;
    onMove: (evt: { viewState: Record<string, number> }) => void;
  }) => (
    <div data-test="maplibre-map" data-map-style={JSON.stringify(mapStyle)}>
      <button
        type="button"
        data-test="maplibre-move"
        onClick={() =>
          onMove({ viewState: { longitude: 1, latitude: 2, zoom: 3 } })
        }
      />
      {children}
    </div>
  ),
}));

jest.mock('react-map-gl/mapbox', () => ({
  Map: ({ children, mapStyle }: { children: ReactNode; mapStyle: unknown }) => (
    <div data-test="mapbox-map" data-map-style={JSON.stringify(mapStyle)}>
      {children}
    </div>
  ),
}));

jest.mock('mapbox-gl', () => ({ accessToken: '' }));

jest.mock(
  './components/DeckGLOverlayMapLibre',
  () =>
    ({ layers }: { layers: unknown[] }) => (
      <div data-test="maplibre-overlay" data-layers-count={layers.length} />
    ),
);

jest.mock(
  './components/DeckGLOverlayMapbox',
  () =>
    ({ layers }: { layers: unknown[] }) => (
      <div data-test="mapbox-overlay" data-layers-count={layers.length} />
    ),
);

jest.mock('./components/Tooltip', () => ({
  __esModule: true,
  default: ({ variant = 'default' }: { variant?: 'default' | 'custom' }) => (
    <div data-test={`tooltip-${variant}`} />
  ),
}));

const baseProps = {
  viewport: { longitude: 0, latitude: 0, zoom: 1, bearing: 0, pitch: 0 },
  width: 800,
  height: 600,
  layers: [],
};

const renderContainer = (
  props: Partial<ComponentProps<typeof DeckGLContainer>>,
) =>
  render(
    <ThemeProvider theme={supersetTheme}>
      <DeckGLContainer {...baseProps} {...props} />
    </ThemeProvider>,
  );

afterEach(() => {
  jest.useRealTimers();
  jest.clearAllMocks();
});

test('DeckGLContainer converts OSM raster tile templates into MapLibre style objects', () => {
  renderContainer({ mapProvider: 'maplibre', mapStyle: OSM_TILE_STYLE_URL });

  const style = JSON.parse(
    screen.getByTestId('maplibre-map').getAttribute('data-map-style') || '{}',
  );

  expect(style.sources['osm-raster-tiles']).toEqual({
    type: 'raster',
    tiles: [OSM_TILE_STYLE_URL],
    tileSize: 256,
    attribution: OSM_TILE_ATTRIBUTION,
  });
  expect(style.layers[0]).toMatchObject({
    id: 'osm-raster-layer',
    type: 'raster',
    source: 'osm-raster-tiles',
  });
});

test('DeckGLContainer passes style JSON URLs through to MapLibre', () => {
  const styleUrl = 'https://example.com/styles/custom-style.json';

  renderContainer({ mapProvider: 'maplibre', mapStyle: styleUrl });

  expect(screen.getByTestId('maplibre-map')).toHaveAttribute(
    'data-map-style',
    JSON.stringify(styleUrl),
  );
});

test('DeckGLContainer keeps the missing Mapbox key signal for saved Mapbox charts', () => {
  renderContainer({
    mapProvider: 'mapbox',
    mapStyle: 'mapbox://styles/mapbox/dark-v9',
    mapboxApiKey: '',
  });

  expect(
    screen.getByText(
      'Mapbox requires a MAPBOX_API_KEY to be configured on the server.',
    ),
  ).toBeInTheDocument();
  expect(screen.queryByTestId('maplibre-map')).not.toBeInTheDocument();
  expect(screen.queryByTestId('mapbox-map')).not.toBeInTheDocument();
});

test('DeckGLContainer passes Mapbox styles through when a key exists', () => {
  renderContainer({
    mapProvider: 'mapbox',
    mapStyle: 'mapbox://styles/mapbox/dark-v9',
    mapboxApiKey: 'pk.test',
  });

  expect(mapboxgl.accessToken).toBe('pk.test');
  expect(screen.getByTestId('mapbox-map')).toHaveAttribute(
    'data-map-style',
    JSON.stringify('mapbox://styles/mapbox/dark-v9'),
  );
});

test('DeckGLContainer supports layer factories for MapLibre overlays', () => {
  const layer = { id: 'layer-1' } as unknown as Layer;
  const layerFactory = () => layer;

  renderContainer({ mapProvider: 'maplibre', layers: [layerFactory] });

  expect(screen.getByTestId('maplibre-overlay')).toHaveAttribute(
    'data-layers-count',
    '1',
  );
});

test('DeckGLContainer updates viewport controls after map movement is throttled', () => {
  jest.useFakeTimers();
  jest.setSystemTime(1000);
  const setControlValue = jest.fn();

  renderContainer({ mapProvider: 'maplibre', setControlValue });
  fireEvent.click(screen.getByTestId('maplibre-move'));

  jest.setSystemTime(1301);
  act(() => {
    jest.advanceTimersByTime(250);
  });

  expect(setControlValue).toHaveBeenCalledWith('viewport', {
    longitude: 1,
    latitude: 2,
    zoom: 3,
  });
});

test('DeckGLContainer suppresses the native context menu', () => {
  renderContainer({ mapProvider: 'maplibre' });

  const event = new MouseEvent('contextmenu', {
    bubbles: true,
    cancelable: true,
  });
  const preventDefaultSpy = jest.spyOn(event, 'preventDefault');
  const stopPropagationSpy = jest.spyOn(event, 'stopPropagation');

  screen.getByTestId('maplibre-map').parentElement?.dispatchEvent(event);

  expect(preventDefaultSpy).toHaveBeenCalled();
  expect(stopPropagationSpy).toHaveBeenCalled();
});

test('DeckGLContainer renders default and custom tooltip variants through its ref', () => {
  const ref = createRef<DeckGLContainerHandle>();

  render(
    <ThemeProvider theme={supersetTheme}>
      <DeckGLContainer {...baseProps} mapProvider="maplibre" ref={ref} />
    </ThemeProvider>,
  );

  act(() => {
    ref.current?.setTooltip({ x: 0, y: 0, content: 'Default tooltip' });
  });
  expect(screen.getByTestId('tooltip-default')).toBeInTheDocument();

  act(() => {
    ref.current?.setTooltip({
      x: 0,
      y: 0,
      content: <span data-tooltip-type="custom">Custom tooltip</span>,
    });
  });
  expect(screen.getByTestId('tooltip-custom')).toBeInTheDocument();
});
