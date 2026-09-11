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
    onIdle,
    onError,
  }: {
    children: ReactNode;
    mapStyle: unknown;
    onMove: (evt: { viewState: Record<string, number> }) => void;
    onIdle: () => void;
    onError: () => void;
  }) => (
    <div data-test="maplibre-map" data-map-style={JSON.stringify(mapStyle)}>
      <button
        type="button"
        aria-label="move map"
        data-test="maplibre-move"
        onClick={() =>
          onMove({ viewState: { longitude: 1, latitude: 2, zoom: 3 } })
        }
      />
      <button type="button" aria-label="idle map" onClick={onIdle} />
      <button type="button" aria-label="fail map" onClick={onError} />
      {children}
    </div>
  ),
}));

jest.mock('react-map-gl/mapbox', () => ({
  Map: ({
    children,
    mapStyle,
    onIdle,
    onError,
  }: {
    children: ReactNode;
    mapStyle: unknown;
    onIdle: () => void;
    onError: () => void;
  }) => (
    <div data-test="mapbox-map" data-map-style={JSON.stringify(mapStyle)}>
      <button type="button" aria-label="idle map" onClick={onIdle} />
      <button type="button" aria-label="fail map" onClick={onError} />
      {children}
    </div>
  ),
}));

jest.mock('mapbox-gl', () => ({ accessToken: '' }));

jest.mock(
  './components/DeckGLOverlayMapLibre',
  () =>
    ({
      layers,
      onAfterRender,
      onError,
    }: {
      layers: unknown[];
      onAfterRender: () => void;
      onError: (error: Error) => void;
    }) => (
      <div data-test="maplibre-overlay" data-layers-count={layers.length}>
        <button
          type="button"
          aria-label="paint layers"
          onClick={onAfterRender}
        />
        <button
          type="button"
          aria-label="fail layers"
          onClick={() => onError(new Error('layer failed'))}
        />
      </div>
    ),
);

jest.mock(
  './components/DeckGLOverlayMapbox',
  () =>
    ({
      layers,
      onAfterRender,
      onError,
    }: {
      layers: unknown[];
      onAfterRender: () => void;
      onError: (error: Error) => void;
    }) => (
      <div data-test="mapbox-overlay" data-layers-count={layers.length}>
        <button
          type="button"
          aria-label="paint layers"
          onClick={onAfterRender}
        />
        <button
          type="button"
          aria-label="fail layers"
          onClick={() => onError(new Error('layer failed'))}
        />
      </div>
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
  const layerFactory = jest.fn(() => layer);

  renderContainer({ mapProvider: 'maplibre', layers: [layerFactory] });

  expect(screen.getByTestId('maplibre-overlay')).toHaveAttribute(
    'data-layers-count',
    '1',
  );
  fireEvent.click(screen.getByRole('button', { name: 'idle map' }));
  fireEvent.click(screen.getByRole('button', { name: 'paint layers' }));
  expect(screen.getByTestId('maplibre-map').parentElement).toHaveAttribute(
    'data-superset-map-status',
    'rendered',
  );
  expect(layerFactory).toHaveBeenCalledTimes(1);
});

test('DeckGLContainer marks map pixels ready only after the map becomes idle', () => {
  const { rerender } = renderContainer({
    mapProvider: 'maplibre',
    mapStyle: 'style-a',
  });

  const mapHost = screen.getByTestId('maplibre-map').parentElement;
  expect(mapHost).toHaveAttribute('data-superset-map-status', 'loading');

  fireEvent.click(screen.getByRole('button', { name: 'idle map' }));
  expect(mapHost).toHaveAttribute('data-superset-map-status', 'loading');

  fireEvent.click(screen.getByRole('button', { name: 'paint layers' }));
  expect(mapHost).toHaveAttribute('data-superset-map-status', 'rendered');

  rerender(
    <ThemeProvider theme={supersetTheme}>
      <DeckGLContainer
        {...baseProps}
        mapProvider="maplibre"
        mapStyle="style-b"
      />
    </ThemeProvider>,
  );
  expect(mapHost).toHaveAttribute('data-superset-map-status', 'loading');

  fireEvent.click(screen.getByRole('button', { name: 'idle map' }));
  expect(mapHost).toHaveAttribute('data-superset-map-status', 'loading');
  fireEvent.click(screen.getByRole('button', { name: 'paint layers' }));
  expect(mapHost).toHaveAttribute('data-superset-map-status', 'rendered');

  // Returning to a previously completed input must create a fresh generation;
  // otherwise stale completion signals from the first style-a render win.
  rerender(
    <ThemeProvider theme={supersetTheme}>
      <DeckGLContainer
        {...baseProps}
        mapProvider="maplibre"
        mapStyle="style-a"
      />
    </ThemeProvider>,
  );
  expect(mapHost).toHaveAttribute('data-superset-map-status', 'loading');
  fireEvent.click(screen.getByRole('button', { name: 'idle map' }));
  expect(mapHost).toHaveAttribute('data-superset-map-status', 'loading');
  fireEvent.click(screen.getByRole('button', { name: 'paint layers' }));
  expect(mapHost).toHaveAttribute('data-superset-map-status', 'rendered');

  fireEvent.click(screen.getByRole('button', { name: 'move map' }));
  expect(mapHost).toHaveAttribute('data-superset-map-status', 'loading');

  fireEvent.click(screen.getByRole('button', { name: 'idle map' }));
  expect(mapHost).toHaveAttribute('data-superset-map-status', 'loading');
  fireEvent.click(screen.getByRole('button', { name: 'paint layers' }));
  expect(mapHost).toHaveAttribute('data-superset-map-status', 'rendered');

  rerender(
    <ThemeProvider theme={supersetTheme}>
      <DeckGLContainer
        {...baseProps}
        viewport={{ ...baseProps.viewport, zoom: 2 }}
        mapProvider="maplibre"
        mapStyle="style-a"
      />
    </ThemeProvider>,
  );
  expect(mapHost).toHaveAttribute('data-superset-map-status', 'loading');
});

test('DeckGLContainer invalidates completion for layers, dimensions, loading, and errors', () => {
  const firstLayer = { id: 'first' } as unknown as Layer;
  const secondLayer = { id: 'second' } as unknown as Layer;
  const { rerender } = renderContainer({
    mapProvider: 'maplibre',
    layers: [firstLayer],
  });
  const mapHost = screen.getByTestId('maplibre-map').parentElement;

  fireEvent.click(screen.getByRole('button', { name: 'idle map' }));
  fireEvent.click(screen.getByRole('button', { name: 'paint layers' }));
  expect(mapHost).toHaveAttribute('data-superset-map-status', 'rendered');

  rerender(
    <ThemeProvider theme={supersetTheme}>
      <DeckGLContainer
        {...baseProps}
        mapProvider="maplibre"
        layers={[secondLayer]}
      />
    </ThemeProvider>,
  );
  expect(mapHost).toHaveAttribute('data-superset-map-status', 'loading');
  fireEvent.click(screen.getByRole('button', { name: 'paint layers' }));
  expect(mapHost).toHaveAttribute('data-superset-map-status', 'rendered');

  rerender(
    <ThemeProvider theme={supersetTheme}>
      <DeckGLContainer
        {...baseProps}
        mapProvider="maplibre"
        layers={[secondLayer]}
        isLoading
      />
    </ThemeProvider>,
  );
  expect(mapHost).toHaveAttribute('data-superset-map-status', 'loading');

  fireEvent.click(screen.getByRole('button', { name: 'fail map' }));
  fireEvent.click(screen.getByRole('button', { name: 'idle map' }));
  fireEvent.click(screen.getByRole('button', { name: 'paint layers' }));
  expect(mapHost).toHaveAttribute('data-superset-map-status', 'loading');

  rerender(
    <ThemeProvider theme={supersetTheme}>
      <DeckGLContainer
        {...baseProps}
        mapProvider="maplibre"
        layers={[secondLayer]}
      />
    </ThemeProvider>,
  );
  fireEvent.click(screen.getByRole('button', { name: 'move map' }));
  fireEvent.click(screen.getByRole('button', { name: 'idle map' }));
  fireEvent.click(screen.getByRole('button', { name: 'paint layers' }));
  expect(mapHost).toHaveAttribute('data-superset-map-status', 'loading');

  rerender(
    <ThemeProvider theme={supersetTheme}>
      <DeckGLContainer
        {...baseProps}
        mapProvider="maplibre"
        mapStyle="recovered-style"
        layers={[secondLayer]}
      />
    </ThemeProvider>,
  );
  fireEvent.click(screen.getByRole('button', { name: 'idle map' }));
  fireEvent.click(screen.getByRole('button', { name: 'paint layers' }));
  expect(mapHost).toHaveAttribute('data-superset-map-status', 'rendered');
});

test('DeckGLContainer does not complete after the current overlay fails', () => {
  const error = jest.spyOn(console, 'error').mockImplementation(() => {});
  const failedLayer = { id: 'failed' } as unknown as Layer;
  const recoveredLayer = { id: 'recovered' } as unknown as Layer;
  const { rerender } = renderContainer({
    mapProvider: 'maplibre',
    layers: [failedLayer],
  });
  const mapHost = screen.getByTestId('maplibre-map').parentElement;

  fireEvent.click(screen.getByRole('button', { name: 'idle map' }));
  fireEvent.click(screen.getByRole('button', { name: 'fail layers' }));
  fireEvent.click(screen.getByRole('button', { name: 'paint layers' }));
  expect(mapHost).toHaveAttribute('data-superset-map-status', 'loading');
  expect(error).toHaveBeenCalledWith(
    'DeckGL rendering failed',
    expect.any(Error),
  );

  rerender(
    <ThemeProvider theme={supersetTheme}>
      <DeckGLContainer
        {...baseProps}
        mapProvider="maplibre"
        layers={[recoveredLayer]}
      />
    </ThemeProvider>,
  );
  fireEvent.click(screen.getByRole('button', { name: 'paint layers' }));
  expect(mapHost).toHaveAttribute('data-superset-map-status', 'rendered');
  error.mockRestore();
});

test('DeckGLContainer requires fresh signals after a Mapbox map remount', () => {
  const { rerender } = renderContainer({
    mapProvider: 'mapbox',
    mapStyle: 'mapbox://styles/mapbox/dark-v9',
    mapboxApiKey: 'pk.test',
  });

  fireEvent.click(screen.getByRole('button', { name: 'idle map' }));
  fireEvent.click(screen.getByRole('button', { name: 'paint layers' }));
  expect(screen.getByTestId('mapbox-map').parentElement).toHaveAttribute(
    'data-superset-map-status',
    'rendered',
  );

  rerender(
    <ThemeProvider theme={supersetTheme}>
      <DeckGLContainer
        {...baseProps}
        mapProvider="mapbox"
        mapStyle="mapbox://styles/mapbox/dark-v9"
      />
    </ThemeProvider>,
  );
  expect(screen.queryByTestId('mapbox-map')).not.toBeInTheDocument();

  rerender(
    <ThemeProvider theme={supersetTheme}>
      <DeckGLContainer
        {...baseProps}
        mapProvider="mapbox"
        mapStyle="mapbox://styles/mapbox/dark-v9"
        mapboxApiKey="pk.test"
      />
    </ThemeProvider>,
  );
  const remountedHost = screen.getByTestId('mapbox-map').parentElement;
  expect(remountedHost).toHaveAttribute('data-superset-map-status', 'loading');
  fireEvent.click(screen.getByRole('button', { name: 'idle map' }));
  expect(remountedHost).toHaveAttribute('data-superset-map-status', 'loading');
  fireEvent.click(screen.getByRole('button', { name: 'paint layers' }));
  expect(remountedHost).toHaveAttribute('data-superset-map-status', 'rendered');
});

test('DeckGLContainer stays complete when controlled viewport catches up after a move', () => {
  const movedViewport = { longitude: 1, latitude: 2, zoom: 3 };
  const { rerender } = renderContainer({ mapProvider: 'maplibre' });
  const mapHost = screen.getByTestId('maplibre-map').parentElement;

  fireEvent.click(screen.getByRole('button', { name: 'move map' }));
  fireEvent.click(screen.getByRole('button', { name: 'idle map' }));
  fireEvent.click(screen.getByRole('button', { name: 'paint layers' }));
  expect(mapHost).toHaveAttribute('data-superset-map-status', 'rendered');

  rerender(
    <ThemeProvider theme={supersetTheme}>
      <DeckGLContainer
        {...baseProps}
        viewport={movedViewport}
        mapProvider="maplibre"
      />
    </ThemeProvider>,
  );

  expect(mapHost).toHaveAttribute('data-superset-map-status', 'rendered');
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
