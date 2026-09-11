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

type MockMapListener = (event: Record<string, unknown>) => void;
type MockMapDataEvent = {
  dataType: string;
  error?: Error;
  sourceDataType?: string;
  sourceId: string;
  tile: object;
};
let mockLastMapData: ((event: MockMapDataEvent) => void) | undefined;
let mockLastMapError:
  | ((event: {
      error?: Error & { status?: number };
      sourceId?: string;
      tile?: object;
    }) => void)
  | undefined;
let mockLastMapIdle: (() => void) | undefined;
let mockLastMapMove:
  | ((event: { viewState: Record<string, number> }) => void)
  | undefined;
let mockLastMapMoveEnd:
  | ((event: { viewState: Record<string, number> }) => void)
  | undefined;
const mockMapListeners = new Map<string, MockMapListener>();
const mockNativeMap = {
  on: jest.fn((eventName: string, listener: MockMapListener) => {
    mockMapListeners.set(eventName, listener);
  }),
  off: jest.fn((eventName: string, listener: MockMapListener) => {
    if (mockMapListeners.get(eventName) === listener) {
      mockMapListeners.delete(eventName);
    }
  }),
};
const mockEmitNativeMapEvent = (
  eventName: 'sourcedataloading' | 'sourcedataabort',
  event: Record<string, unknown>,
) => mockMapListeners.get(eventName)?.(event);
const mockStartMapTile = (sourceId: string, tile: object) =>
  mockEmitNativeMapEvent('sourcedataloading', {
    dataType: 'source',
    sourceId,
    tile,
  });

jest.mock('react-map-gl/maplibre', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const MockMap = React.forwardRef<
    { getMap: () => typeof mockNativeMap },
    {
      children: ReactNode;
      mapStyle: unknown;
      onMove: (evt: { viewState: Record<string, number> }) => void;
      onMoveEnd: (evt: { viewState: Record<string, number> }) => void;
      onIdle: () => void;
      onError: (event: {
        error?: Error & { status?: number };
        sourceId?: string;
        tile?: object;
      }) => void;
      onData: (event: MockMapDataEvent) => void;
    }
  >(
    (
      { children, mapStyle, onMove, onMoveEnd, onIdle, onError, onData },
      ref,
    ) => {
      React.useImperativeHandle(
        ref,
        () => ({ getMap: () => mockNativeMap }),
        [],
      );
      mockLastMapData = onData;
      mockLastMapError = onError;
      mockLastMapIdle = onIdle;
      mockLastMapMove = onMove;
      mockLastMapMoveEnd = onMoveEnd;
      const failTile = (sourceId: string) => {
        const tile = {};
        mockStartMapTile(sourceId, tile);
        onError({ sourceId, tile, error: new Error('tile') });
      };
      const loadTile = (sourceId: string) => {
        const tile = {};
        mockStartMapTile(sourceId, tile);
        onData({ dataType: 'source', sourceId, tile });
      };
      return (
        <div data-test="maplibre-map" data-map-style={JSON.stringify(mapStyle)}>
          <button
            type="button"
            aria-label="move map"
            data-test="maplibre-move"
            onClick={() => {
              const event = {
                viewState: { longitude: 1, latitude: 2, zoom: 3 },
              };
              onMove(event);
              onMoveEnd(event);
            }}
          />
          <button type="button" aria-label="idle map" onClick={onIdle} />
          <button
            type="button"
            aria-label="fail map"
            onClick={() => failTile('base')}
          />
          <button
            type="button"
            aria-label="fail second map source"
            onClick={() => failTile('second')}
          />
          <button
            type="button"
            aria-label="fail map glyph"
            onClick={() => onError({ error: new Error('glyph') })}
          />
          <button
            type="button"
            aria-label="fail map auth"
            onClick={() =>
              onError({
                error: Object.assign(new Error('auth'), { status: 401 }),
              })
            }
          />
          {['base', 'second'].map(sourceId => (
            <button
              key={sourceId}
              type="button"
              aria-label={`load ${sourceId} map tile`}
              onClick={() => loadTile(sourceId)}
            />
          ))}
          {children}
        </div>
      );
    },
  );
  return { Map: MockMap };
});

jest.mock('react-map-gl/mapbox', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const MockMap = React.forwardRef<
    { getMap: () => typeof mockNativeMap },
    {
      children: ReactNode;
      mapStyle: unknown;
      onIdle: () => void;
      onError: (event: {
        error?: Error & { status?: number };
        sourceId?: string;
        tile?: object;
      }) => void;
      onData: (event: MockMapDataEvent) => void;
    }
  >(({ children, mapStyle, onIdle, onError, onData }, ref) => {
    React.useImperativeHandle(ref, () => ({ getMap: () => mockNativeMap }), []);
    const failTile = () => {
      const tile = {};
      mockStartMapTile('base', tile);
      onError({ sourceId: 'base', tile, error: new Error('tile') });
    };
    const loadTile = () => {
      const tile = {};
      mockStartMapTile('base', tile);
      onData({ dataType: 'source', sourceId: 'base', tile });
    };
    const failTileData = () => {
      const tile = {};
      mockStartMapTile('base', tile);
      onData({
        dataType: 'source',
        sourceDataType: 'error',
        sourceId: 'base',
        tile,
        error: new Error('404'),
      });
    };
    return (
      <div data-test="mapbox-map" data-map-style={JSON.stringify(mapStyle)}>
        <button type="button" aria-label="idle map" onClick={onIdle} />
        <button type="button" aria-label="fail map" onClick={failTile} />
        <button
          type="button"
          aria-label="fail map auth"
          onClick={() =>
            onError({
              error: Object.assign(new Error('auth'), { status: 401 }),
            })
          }
        />
        <button
          type="button"
          aria-label="load base map tile"
          onClick={loadTile}
        />
        <button
          type="button"
          aria-label="fail map data"
          onClick={failTileData}
        />
        {children}
      </div>
    );
  });
  return { Map: MockMap };
});

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
  mockLastMapData = undefined;
  mockLastMapError = undefined;
  mockLastMapIdle = undefined;
  mockLastMapMove = undefined;
  mockLastMapMoveEnd = undefined;
  mockMapListeners.clear();
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
  expect(
    screen.getByText(
      'Mapbox requires a MAPBOX_API_KEY to be configured on the server.',
    ),
  ).toHaveAttribute('data-superset-map-status', 'error');
});

test('DeckGLContainer resets fatal errors when Mapbox credentials change', () => {
  const { rerender } = renderContainer({
    mapProvider: 'mapbox',
    mapStyle: 'mapbox://styles/mapbox/dark-v9',
    mapboxApiKey: 'pk.expired',
  });

  fireEvent.click(screen.getByRole('button', { name: 'fail map auth' }));
  expect(screen.getByTestId('mapbox-map').parentElement).toHaveAttribute(
    'data-superset-map-status',
    'error',
  );

  rerender(
    <ThemeProvider theme={supersetTheme}>
      <DeckGLContainer
        {...baseProps}
        mapProvider="mapbox"
        mapStyle="mapbox://styles/mapbox/dark-v9"
        mapboxApiKey="pk.valid"
      />
    </ThemeProvider>,
  );
  fireEvent.click(screen.getByRole('button', { name: 'idle map' }));
  fireEvent.click(screen.getByRole('button', { name: 'paint layers' }));

  expect(screen.getByTestId('mapbox-map').parentElement).toHaveAttribute(
    'data-superset-map-status',
    'rendered',
  );
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

test('DeckGLContainer reports a silent MapLibre tile failure at idle', () => {
  renderContainer({ mapProvider: 'maplibre' });
  const mapHost = screen.getByTestId('maplibre-map').parentElement;

  fireEvent.click(screen.getByRole('button', { name: 'idle map' }));
  fireEvent.click(screen.getByRole('button', { name: 'paint layers' }));
  expect(mapHost).toHaveAttribute('data-superset-map-status', 'rendered');

  act(() => mockStartMapTile('base', {}));
  expect(mapHost).toHaveAttribute('data-superset-map-status', 'loading');
  fireEvent.click(screen.getByRole('button', { name: 'idle map' }));
  expect(mapHost).toHaveAttribute('data-superset-map-status', 'error');
});

test.each(['error', 'data'] as const)(
  'DeckGLContainer reports an untracked MapLibre tile reload %s',
  eventType => {
    renderContainer({ mapProvider: 'maplibre' });
    const mapHost = screen.getByTestId('maplibre-map').parentElement;

    fireEvent.click(screen.getByRole('button', { name: 'idle map' }));
    fireEvent.click(screen.getByRole('button', { name: 'paint layers' }));
    expect(mapHost).toHaveAttribute('data-superset-map-status', 'rendered');

    act(() => {
      const event = {
        dataType: 'source',
        error: new Error('reload failed'),
        sourceDataType: 'error',
        sourceId: 'base',
        tile: {},
      };
      if (eventType === 'data') {
        mockLastMapData?.(event);
      } else {
        mockLastMapError?.(event);
      }
    });
    expect(mapHost).toHaveAttribute('data-superset-map-status', 'loading');
    fireEvent.click(screen.getByRole('button', { name: 'idle map' }));
    expect(mapHost).toHaveAttribute('data-superset-map-status', 'error');
  },
);

test('DeckGLContainer handles source loading and an aborted MapLibre tile', () => {
  renderContainer({ mapProvider: 'maplibre' });
  const mapHost = screen.getByTestId('maplibre-map').parentElement;

  fireEvent.click(screen.getByRole('button', { name: 'idle map' }));
  fireEvent.click(screen.getByRole('button', { name: 'paint layers' }));

  act(() =>
    mockEmitNativeMapEvent('sourcedataloading', {
      dataType: 'source',
      sourceId: 'geojson',
    }),
  );
  expect(mapHost).toHaveAttribute('data-superset-map-status', 'loading');
  fireEvent.click(screen.getByRole('button', { name: 'idle map' }));
  expect(mapHost).toHaveAttribute('data-superset-map-status', 'rendered');

  const abortedTile = {};
  act(() => mockStartMapTile('base', abortedTile));
  act(() =>
    mockEmitNativeMapEvent('sourcedataabort', {
      dataType: 'source',
      sourceId: 'base',
      tile: abortedTile,
    }),
  );
  fireEvent.click(screen.getByRole('button', { name: 'idle map' }));
  expect(mapHost).toHaveAttribute('data-superset-map-status', 'rendered');
});

test('DeckGLContainer ignores stale tile completion and detaches native listeners', () => {
  const { unmount } = renderContainer({ mapProvider: 'maplibre' });
  const mapHost = screen.getByTestId('maplibre-map').parentElement;
  const oldTile = {};
  act(() => mockStartMapTile('base', oldTile));

  fireEvent.click(screen.getByRole('button', { name: 'move map' }));
  const failedTile = {};
  act(() => {
    mockEmitNativeMapEvent('sourcedataabort', {
      dataType: 'source',
      sourceId: 'base',
      tile: oldTile,
    });
    mockStartMapTile('base', failedTile);
    mockLastMapData?.({
      dataType: 'source',
      error: new Error('tile'),
      sourceDataType: 'error',
      sourceId: 'base',
      tile: failedTile,
    });
    mockLastMapData?.({
      dataType: 'source',
      sourceId: 'base',
      tile: oldTile,
    });
  });
  fireEvent.click(screen.getByRole('button', { name: 'idle map' }));
  fireEvent.click(screen.getByRole('button', { name: 'paint layers' }));
  expect(mapHost).toHaveAttribute('data-superset-map-status', 'error');

  unmount();
  expect(mockNativeMap.off).toHaveBeenCalledWith(
    'sourcedataloading',
    expect.any(Function),
  );
  expect(mockNativeMap.off).toHaveBeenCalledWith(
    'sourcedataabort',
    expect.any(Function),
  );
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
  expect(mapHost).toHaveAttribute('data-superset-map-status', 'error');

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
  expect(mapHost).toHaveAttribute('data-superset-map-status', 'error');

  fireEvent.click(screen.getByRole('button', { name: 'load base map tile' }));
  expect(mapHost).toHaveAttribute('data-superset-map-status', 'loading');
  fireEvent.click(screen.getByRole('button', { name: 'idle map' }));
  expect(mapHost).toHaveAttribute('data-superset-map-status', 'rendered');

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

test('DeckGLContainer isolates failed sources and recovers partial tile coverage', () => {
  renderContainer({ mapProvider: 'maplibre' });
  const mapHost = screen.getByTestId('maplibre-map').parentElement;

  fireEvent.click(screen.getByRole('button', { name: 'load base map tile' }));
  fireEvent.click(
    screen.getByRole('button', { name: 'fail second map source' }),
  );
  fireEvent.click(screen.getByRole('button', { name: 'idle map' }));
  fireEvent.click(screen.getByRole('button', { name: 'paint layers' }));
  expect(mapHost).toHaveAttribute('data-superset-map-status', 'error');

  fireEvent.click(screen.getByRole('button', { name: 'load second map tile' }));
  expect(mapHost).toHaveAttribute('data-superset-map-status', 'loading');
  fireEvent.click(screen.getByRole('button', { name: 'idle map' }));
  expect(mapHost).toHaveAttribute('data-superset-map-status', 'rendered');

  // A later 404 from a source that already painted another tile is partial,
  // not evidence that the entire source is blank.
  fireEvent.click(screen.getByRole('button', { name: 'fail map' }));
  fireEvent.click(screen.getByRole('button', { name: 'idle map' }));
  expect(mapHost).toHaveAttribute('data-superset-map-status', 'rendered');
});

test('DeckGLContainer does not reuse tile success from an earlier viewport', () => {
  renderContainer({ mapProvider: 'maplibre' });
  const mapHost = screen.getByTestId('maplibre-map').parentElement;

  fireEvent.click(screen.getByRole('button', { name: 'load base map tile' }));
  fireEvent.click(screen.getByRole('button', { name: 'idle map' }));
  fireEvent.click(screen.getByRole('button', { name: 'paint layers' }));
  expect(mapHost).toHaveAttribute('data-superset-map-status', 'rendered');

  fireEvent.click(screen.getByRole('button', { name: 'move map' }));
  fireEvent.click(screen.getByRole('button', { name: 'fail map' }));
  fireEvent.click(screen.getByRole('button', { name: 'idle map' }));
  fireEvent.click(screen.getByRole('button', { name: 'paint layers' }));
  expect(mapHost).toHaveAttribute('data-superset-map-status', 'error');
});

test('DeckGLContainer tracks tile loading emitted with a viewport move', () => {
  renderContainer({ mapProvider: 'maplibre' });
  const mapHost = screen.getByTestId('maplibre-map').parentElement;

  fireEvent.click(screen.getByRole('button', { name: 'load base map tile' }));
  fireEvent.click(screen.getByRole('button', { name: 'idle map' }));
  fireEvent.click(screen.getByRole('button', { name: 'paint layers' }));
  expect(mapHost).toHaveAttribute('data-superset-map-status', 'rendered');

  const pendingTile = {};
  act(() => {
    const event = {
      viewState: { longitude: 1, latitude: 2, zoom: 3 },
    };
    mockLastMapMove?.(event);
    mockLastMapMoveEnd?.(event);
    mockStartMapTile('base', pendingTile);
  });
  fireEvent.click(screen.getByRole('button', { name: 'idle map' }));
  fireEvent.click(screen.getByRole('button', { name: 'paint layers' }));

  expect(mapHost).toHaveAttribute('data-superset-map-status', 'error');
});

test('DeckGLContainer accepts cached idle emitted with a viewport move', () => {
  renderContainer({ mapProvider: 'maplibre' });
  const mapHost = screen.getByTestId('maplibre-map').parentElement;

  act(() => {
    const event = {
      viewState: { longitude: 1, latitude: 2, zoom: 3 },
    };
    mockLastMapMove?.(event);
    mockLastMapMoveEnd?.(event);
    mockLastMapIdle?.();
  });
  fireEvent.click(screen.getByRole('button', { name: 'paint layers' }));

  expect(mapHost).toHaveAttribute('data-superset-map-status', 'rendered');
});

test('DeckGLContainer accepts tile completion emitted with a viewport move', () => {
  renderContainer({ mapProvider: 'maplibre' });
  const mapHost = screen.getByTestId('maplibre-map').parentElement;
  const tile = {};

  act(() => {
    const event = {
      viewState: { longitude: 1, latitude: 2, zoom: 3 },
    };
    mockLastMapMove?.(event);
    mockLastMapMoveEnd?.(event);
    mockStartMapTile('base', tile);
    mockLastMapData?.({ dataType: 'source', sourceId: 'base', tile });
    mockLastMapIdle?.();
  });
  fireEvent.click(screen.getByRole('button', { name: 'paint layers' }));

  expect(mapHost).toHaveAttribute('data-superset-map-status', 'rendered');
});

test('DeckGLContainer keeps pending tiles observable across move end', () => {
  renderContainer({ mapProvider: 'maplibre' });
  const mapHost = screen.getByTestId('maplibre-map').parentElement;
  const event = {
    viewState: { longitude: 1, latitude: 2, zoom: 3 },
  };
  const tile = {};

  act(() => {
    mockLastMapMove?.(event);
    mockStartMapTile('base', tile);
    mockLastMapMoveEnd?.(event);
    mockLastMapData?.({
      dataType: 'source',
      error: new Error('tile'),
      sourceDataType: 'error',
      sourceId: 'base',
      tile,
    });
    mockLastMapIdle?.();
  });
  fireEvent.click(screen.getByRole('button', { name: 'paint layers' }));

  expect(mapHost).toHaveAttribute('data-superset-map-status', 'error');
});

test('DeckGLContainer clears intermediate success for final failures', () => {
  renderContainer({ mapProvider: 'maplibre' });
  const mapHost = screen.getByTestId('maplibre-map').parentElement;
  const firstEvent = {
    viewState: { longitude: 1, latitude: 2, zoom: 3 },
  };
  const finalEvent = {
    viewState: { longitude: 4, latitude: 5, zoom: 6 },
  };
  const intermediateTile = {};

  act(() => {
    mockLastMapMove?.(firstEvent);
    mockStartMapTile('base', intermediateTile);
  });
  act(() => {
    mockLastMapMove?.(finalEvent);
    mockLastMapData?.({
      dataType: 'source',
      sourceId: 'base',
      tile: intermediateTile,
    });
    mockLastMapMoveEnd?.(finalEvent);
    const failedTile = {};
    mockStartMapTile('base', failedTile);
    mockLastMapData?.({
      dataType: 'source',
      error: new Error('tile'),
      sourceDataType: 'error',
      sourceId: 'base',
      tile: failedTile,
    });
    mockLastMapIdle?.();
  });
  fireEvent.click(screen.getByRole('button', { name: 'paint layers' }));

  expect(mapHost).toHaveAttribute('data-superset-map-status', 'error');
});

test('DeckGLContainer retries generic map errors but fails authentication errors', () => {
  const { rerender } = renderContainer({ mapProvider: 'maplibre' });
  const mapHost = screen.getByTestId('maplibre-map').parentElement;

  fireEvent.click(screen.getByRole('button', { name: 'idle map' }));
  fireEvent.click(screen.getByRole('button', { name: 'paint layers' }));
  fireEvent.click(screen.getByRole('button', { name: 'fail map glyph' }));
  expect(mapHost).toHaveAttribute('data-superset-map-status', 'loading');
  fireEvent.click(screen.getByRole('button', { name: 'idle map' }));
  expect(mapHost).toHaveAttribute('data-superset-map-status', 'rendered');

  fireEvent.click(screen.getByRole('button', { name: 'fail map auth' }));
  expect(mapHost).toHaveAttribute('data-superset-map-status', 'error');

  rerender(
    <ThemeProvider theme={supersetTheme}>
      <DeckGLContainer
        {...baseProps}
        mapProvider="maplibre"
        mapStyle="new-style"
      />
    </ThemeProvider>,
  );
  expect(mapHost).toHaveAttribute('data-superset-map-status', 'loading');
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
  expect(mapHost).toHaveAttribute('data-superset-map-status', 'error');
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

test('DeckGLContainer treats Mapbox source data errors as failed tiles', () => {
  renderContainer({
    mapProvider: 'mapbox',
    mapStyle: 'mapbox://styles/mapbox/dark-v9',
    mapboxApiKey: 'pk.test',
  });
  const mapHost = screen.getByTestId('mapbox-map').parentElement;

  fireEvent.click(screen.getByRole('button', { name: 'idle map' }));
  fireEvent.click(screen.getByRole('button', { name: 'paint layers' }));
  expect(mapHost).toHaveAttribute('data-superset-map-status', 'rendered');

  fireEvent.click(screen.getByRole('button', { name: 'fail map data' }));
  expect(mapHost).toHaveAttribute('data-superset-map-status', 'loading');
  fireEvent.click(screen.getByRole('button', { name: 'idle map' }));
  expect(mapHost).toHaveAttribute('data-superset-map-status', 'error');
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
