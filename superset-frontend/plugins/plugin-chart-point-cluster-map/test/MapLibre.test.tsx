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

import { type ReactNode } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import {
  OSM_TILE_ATTRIBUTION,
  OSM_TILE_STYLE_URL,
} from '@superset-ui/core/utils/mapStyles';

// Capture the most recent viewport props passed to the Map component
let lastMapProps: Record<string, unknown> = {};
const mockFitBounds = jest.fn();
type MockMapListener = (event: Record<string, unknown>) => void;
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

const emitNativeMapEvent = (
  eventName: 'sourcedataloading' | 'sourcedataabort',
  event: Record<string, unknown>,
) => mockMapListeners.get(eventName)?.(event);

jest.mock('react-map-gl/maplibre', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const MockMap = React.forwardRef<
    { getMap: () => typeof mockNativeMap },
    Record<string, unknown>
  >((props, ref) => {
    lastMapProps = props;
    React.useImperativeHandle(ref, () => ({ getMap: () => mockNativeMap }), []);
    return <div data-testid="map-gl">{props.children as ReactNode}</div>;
  });
  return { __esModule: true, Map: MockMap };
});

jest.mock('react-map-gl/mapbox', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const MockMap = React.forwardRef<
    { getMap: () => typeof mockNativeMap },
    Record<string, unknown>
  >((props, ref) => {
    lastMapProps = props;
    React.useImperativeHandle(ref, () => ({ getMap: () => mockNativeMap }), []);
    return <div data-testid="map-gl">{props.children as ReactNode}</div>;
  });
  return { __esModule: true, Map: MockMap };
});

jest.mock('@math.gl/web-mercator', () => ({
  WebMercatorViewport: jest
    .fn()
    .mockImplementation(
      ({ width, height }: { width: number; height: number }) => ({
        fitBounds: (bounds: [[number, number], [number, number]]) =>
          mockFitBounds(bounds, width, height),
      }),
    ),
}));

jest.mock('../src/components/ScatterPlotOverlay', () => {
  const MockOverlay = (props: Record<string, unknown>) => (
    <div data-testid="scatter-overlay" data-opacity={props.globalOpacity}>
      <button
        type="button"
        aria-label="redraw overlay"
        onClick={props.onRedraw as () => void}
      />
    </div>
  );
  return { __esModule: true, default: MockOverlay };
});

jest.mock('@apache-superset/core/theme', () => ({
  useTheme: () => ({ colorTextSecondary: '#666' }),
}));

jest.mock('maplibre-gl/dist/maplibre-gl.css', () => ({}));
jest.mock('../src/MapLibre.css', () => ({}));

// maplibre-gl 6 is an ESM-only package with no "require"/"default" export
// condition, so jest's (CJS-based) resolver can't locate the real module to
// mock over it by name; { virtual: true } skips that resolution step.
//
// The mock jest.fn() is created inline (not hoisted out to a `const`)
// because MapLibre.tsx calls maplibregl.setWorkerUrl() synchronously at
// import time, and `import`/jest.mock() calls are themselves hoisted above
// this file's plain `const` declarations — a `const` referenced here would
// still be in its temporal dead zone when that import-time call fires.
jest.mock(
  'maplibre-gl',
  () => ({ __esModule: true, setWorkerUrl: jest.fn() }),
  { virtual: true },
);

// eslint-disable-next-line import/first
import * as maplibregl from 'maplibre-gl';
// eslint-disable-next-line import/first
import MapLibre from '../src/MapLibre';

const defaultProps = {
  width: 800,
  height: 600,
  clusterer: {
    getClusters: jest.fn().mockReturnValue([]),
  },
  globalOpacity: 1,
  mapProvider: 'maplibre',
  mapStyle: 'https://tiles.openfreemap.org/styles/liberty',
  pointRadius: 60,
  pointRadiusUnit: 'Pixels',
  renderWhileDragging: true,
  rgb: ['', 255, 0, 0] as (string | number)[],
  hasCustomMetric: false,
  bounds: [
    [-74.0, 40.7],
    [-73.9, 40.8],
  ] as [[number, number], [number, number]],
  onViewportChange: jest.fn(),
};

const startMapTile = (sourceId: string, tile: object) =>
  emitNativeMapEvent('sourcedataloading', {
    dataType: 'source',
    sourceId,
    tile,
  });

const endMapMove = (viewState: {
  longitude: number;
  latitude: number;
  zoom: number;
}) => {
  const event = { viewState };
  (lastMapProps.onMoveEnd as (moveEvent: typeof event) => void)(event);
};

const moveMap = (
  viewState: { longitude: number; latitude: number; zoom: number },
  complete = true,
) => {
  const event = { viewState };
  (lastMapProps.onMove as (moveEvent: typeof event) => void)(event);
  if (complete) {
    endMapMove(viewState);
  }
};

// Captured before the first jest.clearAllMocks() below wipes the call the
// module made at import time.
const setWorkerUrlCallAtImport = [
  ...jest.mocked(maplibregl.setWorkerUrl).mock.calls,
];

test('points maplibre-gl at the CopyPlugin-emitted worker asset before any map can mount', () => {
  // maplibre-gl 6's ESM-only build derives its worker URL from
  // `import.meta.url`, which webpack rewrites to a build-time path that
  // doesn't match maplibre's `^https?:` check, so the worker silently
  // fails to start unless setWorkerUrl() is called first (see MapLibre.tsx).
  expect(setWorkerUrlCallAtImport).toEqual([
    ['/static/assets/maplibre-gl-worker.mjs'],
  ]);
});

beforeEach(() => {
  lastMapProps = {};
  mockMapListeners.clear();
  document.body.innerHTML = '';
  jest.clearAllMocks();
  mockFitBounds.mockImplementation(
    (
      bounds: [[number, number], [number, number]],
      width: number,
      height: number,
    ) => ({
      latitude: Number(((bounds[0][1] + bounds[1][1]) / 2).toFixed(2)),
      longitude: Number(((bounds[0][0] + bounds[1][0]) / 2).toFixed(2)),
      zoom: Number((10 + width / 1000 + height / 10000).toFixed(2)),
    }),
  );
});

test('initializes viewport from bounds', () => {
  render(<MapLibre {...defaultProps} />);
  expect(lastMapProps.longitude).toBe(-73.95);
  expect(lastMapProps.latitude).toBe(40.75);
  expect(lastMapProps.zoom).toBe(10.86);
});

test('initializes viewport from props when provided', () => {
  render(
    <MapLibre
      {...defaultProps}
      viewportLongitude={-122.4}
      viewportLatitude={37.8}
      viewportZoom={5}
    />,
  );
  expect(lastMapProps.longitude).toBe(-122.4);
  expect(lastMapProps.latitude).toBe(37.8);
  expect(lastMapProps.zoom).toBe(5);
});

test('updates viewport when viewport props change', () => {
  const { rerender } = render(
    <MapLibre
      {...defaultProps}
      viewportLongitude={-73.95}
      viewportLatitude={40.75}
      viewportZoom={10}
    />,
  );

  rerender(
    <MapLibre
      {...defaultProps}
      viewportLongitude={-122.4}
      viewportLatitude={37.8}
      viewportZoom={5}
    />,
  );

  expect(lastMapProps.longitude).toBe(-122.4);
  expect(lastMapProps.latitude).toBe(37.8);
  expect(lastMapProps.zoom).toBe(5);
});

test('does not loop when viewport state matches new props', () => {
  const { rerender } = render(
    <MapLibre
      {...defaultProps}
      viewportLongitude={-73.95}
      viewportLatitude={40.75}
      viewportZoom={10}
    />,
  );

  rerender(
    <MapLibre
      {...defaultProps}
      viewportLongitude={-73.95}
      viewportLatitude={40.75}
      viewportZoom={10}
    />,
  );

  expect(lastMapProps.longitude).toBe(-73.95);
  expect(lastMapProps.latitude).toBe(40.75);
  expect(lastMapProps.zoom).toBe(10);
});

test('passes globalOpacity to ScatterPlotOverlay', () => {
  const { container } = render(
    <MapLibre {...defaultProps} globalOpacity={0.5} />,
  );
  const overlay = container.querySelector('[data-testid="scatter-overlay"]');
  expect(overlay).not.toBeNull();
  expect(overlay!.getAttribute('data-opacity')).toBe('0.5');
});

test('marks map pixels ready only after map idle and canvas redraw', () => {
  const { container, rerender } = render(<MapLibre {...defaultProps} />);
  const mapHost = container.querySelector('[data-superset-map-status]');
  expect(mapHost).toHaveAttribute('data-superset-map-status', 'loading');

  act(() => (lastMapProps.onIdle as () => void)());
  expect(mapHost).toHaveAttribute('data-superset-map-status', 'loading');

  fireEvent.click(screen.getByRole('button', { name: 'redraw overlay' }));
  expect(mapHost).toHaveAttribute('data-superset-map-status', 'rendered');

  rerender(<MapLibre {...defaultProps} globalOpacity={0.5} />);
  expect(mapHost).toHaveAttribute('data-superset-map-status', 'loading');
  fireEvent.click(screen.getByRole('button', { name: 'redraw overlay' }));
  expect(mapHost).toHaveAttribute('data-superset-map-status', 'rendered');

  act(() => moveMap({ longitude: 1, latitude: 2, zoom: 3 }));
  expect(mapHost).toHaveAttribute('data-superset-map-status', 'loading');

  const failedTile = {};
  act(() => {
    startMapTile('base', failedTile);
    (
      lastMapProps.onError as (event: {
        error: Error;
        sourceId: string;
        tile: object;
      }) => void
    )({ error: new Error('tile'), sourceId: 'base', tile: failedTile });
  });
  act(() => (lastMapProps.onIdle as () => void)());
  fireEvent.click(screen.getByRole('button', { name: 'redraw overlay' }));
  expect(mapHost).toHaveAttribute('data-superset-map-status', 'error');

  act(() => moveMap({ longitude: 4, latitude: 5, zoom: 6 }));
  act(() => (lastMapProps.onIdle as () => void)());
  fireEvent.click(screen.getByRole('button', { name: 'redraw overlay' }));
  expect(mapHost).toHaveAttribute('data-superset-map-status', 'error');

  const recoveredTile = {};
  act(() => {
    startMapTile('base', recoveredTile);
    (
      lastMapProps.onData as (event: {
        dataType: string;
        sourceId: string;
        tile: object;
      }) => void
    )({
      dataType: 'source',
      sourceId: 'base',
      tile: recoveredTile,
    });
  });
  expect(mapHost).toHaveAttribute('data-superset-map-status', 'loading');
  act(() => (lastMapProps.onIdle as () => void)());
  expect(mapHost).toHaveAttribute('data-superset-map-status', 'rendered');

  rerender(<MapLibre {...defaultProps} mapStyle="recovered-style" />);
  act(() => (lastMapProps.onIdle as () => void)());
  fireEvent.click(screen.getByRole('button', { name: 'redraw overlay' }));
  expect(mapHost).toHaveAttribute('data-superset-map-status', 'rendered');
});

test('reports a MapLibre tile start with no terminal event as an error at idle', () => {
  const { container } = render(<MapLibre {...defaultProps} />);
  const mapHost = container.querySelector('[data-superset-map-status]');

  act(() => (lastMapProps.onIdle as () => void)());
  fireEvent.click(screen.getByRole('button', { name: 'redraw overlay' }));
  expect(mapHost).toHaveAttribute('data-superset-map-status', 'rendered');

  act(() => startMapTile('base', {}));
  expect(mapHost).toHaveAttribute('data-superset-map-status', 'loading');
  act(() => (lastMapProps.onIdle as () => void)());
  expect(mapHost).toHaveAttribute('data-superset-map-status', 'error');
});

test.each(['onError', 'onData'] as const)(
  'reports an untracked MapLibre tile reload failure from %s',
  handlerName => {
    const { container } = render(<MapLibre {...defaultProps} />);
    const mapHost = container.querySelector('[data-superset-map-status]');

    act(() => (lastMapProps.onIdle as () => void)());
    fireEvent.click(screen.getByRole('button', { name: 'redraw overlay' }));
    expect(mapHost).toHaveAttribute('data-superset-map-status', 'rendered');

    const event = {
      dataType: 'source',
      error: new Error('reload failed'),
      sourceDataType: 'error',
      sourceId: 'base',
      tile: {},
    };
    act(() =>
      (
        lastMapProps[handlerName] as (
          resourceEvent: Record<string, unknown>,
        ) => void
      )(event),
    );
    expect(mapHost).toHaveAttribute('data-superset-map-status', 'loading');
    act(() => (lastMapProps.onIdle as () => void)());
    expect(mapHost).toHaveAttribute('data-superset-map-status', 'error');
  },
);

test('invalidates on source loading and accepts an explicitly aborted tile', () => {
  const { container } = render(<MapLibre {...defaultProps} />);
  const mapHost = container.querySelector('[data-superset-map-status]');

  act(() => (lastMapProps.onIdle as () => void)());
  fireEvent.click(screen.getByRole('button', { name: 'redraw overlay' }));

  act(() =>
    emitNativeMapEvent('sourcedataloading', {
      dataType: 'source',
      sourceId: 'geojson',
    }),
  );
  expect(mapHost).toHaveAttribute('data-superset-map-status', 'loading');
  act(() => (lastMapProps.onIdle as () => void)());
  expect(mapHost).toHaveAttribute('data-superset-map-status', 'rendered');

  const abortedTile = {};
  act(() => startMapTile('base', abortedTile));
  expect(mapHost).toHaveAttribute('data-superset-map-status', 'loading');
  act(() =>
    emitNativeMapEvent('sourcedataabort', {
      dataType: 'source',
      sourceId: 'base',
      tile: abortedTile,
    }),
  );
  act(() => (lastMapProps.onIdle as () => void)());
  expect(mapHost).toHaveAttribute('data-superset-map-status', 'rendered');
});

test('ignores a tile terminal event from the prior viewport and detaches listeners', () => {
  const { container, unmount } = render(<MapLibre {...defaultProps} />);
  const mapHost = container.querySelector('[data-superset-map-status]');
  const oldTile = {};
  act(() => startMapTile('base', oldTile));

  act(() => moveMap({ longitude: 4, latitude: 5, zoom: 6 }));
  const failedTile = {};
  act(() => {
    emitNativeMapEvent('sourcedataabort', {
      dataType: 'source',
      sourceId: 'base',
      tile: oldTile,
    });
    startMapTile('base', failedTile);
    (lastMapProps.onError as (event: Record<string, unknown>) => void)({
      error: new Error('tile'),
      sourceId: 'base',
      tile: failedTile,
    });
    (lastMapProps.onData as (event: Record<string, unknown>) => void)({
      dataType: 'source',
      sourceId: 'base',
      tile: oldTile,
    });
    (lastMapProps.onIdle as () => void)();
  });
  fireEvent.click(screen.getByRole('button', { name: 'redraw overlay' }));
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

test('keeps map source failures isolated and accepts partial tile coverage', () => {
  const { container } = render(<MapLibre {...defaultProps} />);
  const mapHost = container.querySelector('[data-superset-map-status]');
  const onData = lastMapProps.onData as (
    event: Record<string, unknown>,
  ) => void;
  const onError = lastMapProps.onError as (
    event: Record<string, unknown>,
  ) => void;

  act(() => {
    const baseTile = {};
    const secondTile = {};
    startMapTile('base', baseTile);
    onData({
      dataType: 'source',
      sourceId: 'base',
      tile: baseTile,
    });
    startMapTile('second', secondTile);
    onData({
      dataType: 'source',
      sourceDataType: 'error',
      sourceId: 'second',
      tile: secondTile,
      error: new Error('tile'),
    });
    (lastMapProps.onIdle as () => void)();
  });
  fireEvent.click(screen.getByRole('button', { name: 'redraw overlay' }));
  expect(mapHost).toHaveAttribute('data-superset-map-status', 'error');

  const recoveredSecondTile = {};
  act(() => {
    startMapTile('second', recoveredSecondTile);
    onData({
      dataType: 'source',
      sourceId: 'second',
      tile: recoveredSecondTile,
    });
  });
  expect(mapHost).toHaveAttribute('data-superset-map-status', 'loading');
  act(() => (lastMapProps.onIdle as () => void)());
  expect(mapHost).toHaveAttribute('data-superset-map-status', 'rendered');

  const partialFailure = {};
  act(() => {
    startMapTile('base', partialFailure);
    onError({
      sourceId: 'base',
      tile: partialFailure,
      error: new Error('404'),
    });
  });
  act(() => (lastMapProps.onIdle as () => void)());
  expect(mapHost).toHaveAttribute('data-superset-map-status', 'rendered');
});

test('does not reuse tile success from an earlier viewport', () => {
  const { container } = render(<MapLibre {...defaultProps} />);
  const mapHost = container.querySelector('[data-superset-map-status]');

  const firstTile = {};
  act(() => {
    startMapTile('base', firstTile);
    (lastMapProps.onData as (event: Record<string, unknown>) => void)({
      dataType: 'source',
      sourceId: 'base',
      tile: firstTile,
    });
    (lastMapProps.onIdle as () => void)();
  });
  fireEvent.click(screen.getByRole('button', { name: 'redraw overlay' }));
  expect(mapHost).toHaveAttribute('data-superset-map-status', 'rendered');

  act(() => moveMap({ longitude: 4, latitude: 5, zoom: 6 }));
  const failedTile = {};
  act(() => {
    startMapTile('base', failedTile);
    (lastMapProps.onError as (event: Record<string, unknown>) => void)({
      sourceId: 'base',
      tile: failedTile,
      error: new Error('tile'),
    });
    (lastMapProps.onIdle as () => void)();
  });
  fireEvent.click(screen.getByRole('button', { name: 'redraw overlay' }));
  expect(mapHost).toHaveAttribute('data-superset-map-status', 'error');
});

test('retries generic map errors and reports authentication failures', () => {
  const { container, rerender } = render(<MapLibre {...defaultProps} />);
  const mapHost = container.querySelector('[data-superset-map-status]');
  const onError = lastMapProps.onError as (
    event: Record<string, unknown>,
  ) => void;

  act(() => (lastMapProps.onIdle as () => void)());
  fireEvent.click(screen.getByRole('button', { name: 'redraw overlay' }));
  act(() => onError({ error: new Error('glyph') }));
  expect(mapHost).toHaveAttribute('data-superset-map-status', 'loading');
  act(() => (lastMapProps.onIdle as () => void)());
  expect(mapHost).toHaveAttribute('data-superset-map-status', 'rendered');

  act(() =>
    onError({
      error: Object.assign(new Error('auth'), { status: 403 }),
    }),
  );
  expect(mapHost).toHaveAttribute('data-superset-map-status', 'error');

  const tile = {};
  act(() => {
    startMapTile('base', tile);
    (lastMapProps.onData as (event: Record<string, unknown>) => void)({
      dataType: 'source',
      sourceId: 'base',
      tile,
    });
    (lastMapProps.onIdle as () => void)();
  });
  expect(mapHost).toHaveAttribute('data-superset-map-status', 'error');

  rerender(<MapLibre {...defaultProps} mapStyle="new-style" />);
  act(() => (lastMapProps.onIdle as () => void)());
  expect(mapHost).toHaveAttribute('data-superset-map-status', 'rendered');
});

test('converts OSM raster tile templates into MapLibre style objects', () => {
  render(<MapLibre {...defaultProps} mapStyle={OSM_TILE_STYLE_URL} />);

  expect(lastMapProps.mapStyle).toEqual({
    version: 8,
    sources: {
      'osm-raster-tiles': {
        type: 'raster',
        tiles: [OSM_TILE_STYLE_URL],
        tileSize: 256,
        attribution: OSM_TILE_ATTRIBUTION,
      },
    },
    layers: [
      {
        id: 'osm-raster-layer',
        type: 'raster',
        source: 'osm-raster-tiles',
        minzoom: 0,
        maxzoom: 22,
      },
    ],
  });
});

test('keeps the missing Mapbox key signal for saved Mapbox charts', () => {
  render(
    <MapLibre
      {...defaultProps}
      mapProvider="mapbox"
      mapStyle="mapbox://styles/mapbox/dark-v11"
    />,
  );

  expect(
    screen.getByText(
      'Mapbox requires a MAPBOX_API_KEY to be configured on the server.',
    ),
  ).toBeInTheDocument();
  expect(lastMapProps.mapStyle).toBeUndefined();
  expect(
    screen.getByText(
      'Mapbox requires a MAPBOX_API_KEY to be configured on the server.',
    ),
  ).toHaveAttribute('data-superset-map-status', 'error');
});

test('passes Mapbox styles through when a key exists', () => {
  document.body.innerHTML = `<div id="app" data-bootstrap='${JSON.stringify({
    common: { conf: { MAPBOX_API_KEY: 'pk.test' } },
  })}'></div>`;

  render(
    <MapLibre
      {...defaultProps}
      mapProvider="mapbox"
      mapStyle="mapbox://styles/mapbox/dark-v11"
    />,
  );

  expect(lastMapProps.mapStyle).toBe('mapbox://styles/mapbox/dark-v11');
  expect(lastMapProps.mapboxAccessToken).toBe('pk.test');
});

test('does not let late Mapbox tile success mask a failed new viewport', () => {
  document.body.innerHTML = `<div id="app" data-bootstrap='${JSON.stringify({
    common: { conf: { MAPBOX_API_KEY: 'pk.test' } },
  })}'></div>`;
  const { container } = render(
    <MapLibre
      {...defaultProps}
      mapProvider="mapbox"
      mapStyle="mapbox://styles/mapbox/dark-v11"
    />,
  );
  const mapHost = container.querySelector('[data-superset-map-status]');
  const oldTile = {};
  act(() => startMapTile('base', oldTile));

  act(() => moveMap({ longitude: 4, latitude: 5, zoom: 6 }));
  const failedTile = {};
  act(() => {
    startMapTile('base', failedTile);
    (lastMapProps.onData as (event: Record<string, unknown>) => void)({
      dataType: 'source',
      sourceDataType: 'error',
      sourceId: 'base',
      tile: failedTile,
      error: new Error('tile'),
    });
    (lastMapProps.onData as (event: Record<string, unknown>) => void)({
      dataType: 'source',
      sourceId: 'base',
      tile: oldTile,
    });
    (lastMapProps.onIdle as () => void)();
  });
  fireEvent.click(screen.getByRole('button', { name: 'redraw overlay' }));

  expect(mapHost).toHaveAttribute('data-superset-map-status', 'error');
});

test('tracks tile loading emitted synchronously with a viewport move', () => {
  const { container } = render(<MapLibre {...defaultProps} />);
  const mapHost = container.querySelector('[data-superset-map-status]');
  const paintedTile = {};
  act(() => {
    startMapTile('base', paintedTile);
    (lastMapProps.onData as (event: Record<string, unknown>) => void)({
      dataType: 'source',
      sourceId: 'base',
      tile: paintedTile,
    });
    (lastMapProps.onIdle as () => void)();
  });
  fireEvent.click(screen.getByRole('button', { name: 'redraw overlay' }));
  expect(mapHost).toHaveAttribute('data-superset-map-status', 'rendered');

  const pendingTile = {};
  act(() => {
    moveMap({ longitude: 4, latitude: 5, zoom: 6 });
    startMapTile('base', pendingTile);
  });
  act(() => (lastMapProps.onIdle as () => void)());
  fireEvent.click(screen.getByRole('button', { name: 'redraw overlay' }));

  expect(mapHost).toHaveAttribute('data-superset-map-status', 'error');
});

test('accepts cached map idle emitted synchronously with a viewport move', () => {
  const { container } = render(<MapLibre {...defaultProps} />);
  const mapHost = container.querySelector('[data-superset-map-status]');

  act(() => {
    moveMap({ longitude: 4, latitude: 5, zoom: 6 });
    (lastMapProps.onIdle as () => void)();
  });
  fireEvent.click(screen.getByRole('button', { name: 'redraw overlay' }));

  expect(mapHost).toHaveAttribute('data-superset-map-status', 'rendered');
});

test('accepts a tile terminal emitted synchronously with a viewport move', () => {
  const { container } = render(<MapLibre {...defaultProps} />);
  const mapHost = container.querySelector('[data-superset-map-status]');
  const tile = {};

  act(() => {
    moveMap({ longitude: 4, latitude: 5, zoom: 6 });
    startMapTile('base', tile);
    (lastMapProps.onData as (event: Record<string, unknown>) => void)({
      dataType: 'source',
      sourceId: 'base',
      tile,
    });
    (lastMapProps.onIdle as () => void)();
  });
  fireEvent.click(screen.getByRole('button', { name: 'redraw overlay' }));

  expect(mapHost).toHaveAttribute('data-superset-map-status', 'rendered');
});

test('keeps a pending tile observable across the final move frame', () => {
  const { container } = render(<MapLibre {...defaultProps} />);
  const mapHost = container.querySelector('[data-superset-map-status]');
  const viewState = { longitude: 4, latitude: 5, zoom: 6 };
  const tile = {};

  act(() => {
    moveMap(viewState, false);
    startMapTile('base', tile);
    endMapMove(viewState);
    (lastMapProps.onError as (event: Record<string, unknown>) => void)({
      sourceId: 'base',
      tile,
      error: new Error('tile'),
    });
    (lastMapProps.onIdle as () => void)();
  });
  fireEvent.click(screen.getByRole('button', { name: 'redraw overlay' }));

  expect(mapHost).toHaveAttribute('data-superset-map-status', 'error');
});

test('allows a pending tile to abort after the final move frame', () => {
  const { container } = render(<MapLibre {...defaultProps} />);
  const mapHost = container.querySelector('[data-superset-map-status]');
  const viewState = { longitude: 4, latitude: 5, zoom: 6 };
  const tile = {};

  act(() => {
    moveMap(viewState, false);
    startMapTile('base', tile);
    endMapMove(viewState);
    emitNativeMapEvent('sourcedataabort', {
      dataType: 'source',
      sourceId: 'base',
      tile,
    });
    (lastMapProps.onIdle as () => void)();
  });
  fireEvent.click(screen.getByRole('button', { name: 'redraw overlay' }));

  expect(mapHost).toHaveAttribute('data-superset-map-status', 'rendered');
});

test('does not carry an intermediate-frame success into final failures', () => {
  const { container } = render(<MapLibre {...defaultProps} />);
  const mapHost = container.querySelector('[data-superset-map-status]');
  const firstView = { longitude: 1, latitude: 2, zoom: 3 };
  const finalView = { longitude: 4, latitude: 5, zoom: 6 };
  const intermediateTile = {};

  act(() => {
    moveMap(firstView, false);
    startMapTile('base', intermediateTile);
  });
  act(() => {
    moveMap(finalView, false);
    (lastMapProps.onData as (event: Record<string, unknown>) => void)({
      dataType: 'source',
      sourceId: 'base',
      tile: intermediateTile,
    });
    endMapMove(finalView);
    const failedTile = {};
    startMapTile('base', failedTile);
    (lastMapProps.onError as (event: Record<string, unknown>) => void)({
      sourceId: 'base',
      tile: failedTile,
      error: new Error('tile'),
    });
    (lastMapProps.onIdle as () => void)();
  });
  fireEvent.click(screen.getByRole('button', { name: 'redraw overlay' }));

  expect(mapHost).toHaveAttribute('data-superset-map-status', 'error');
});

test('handles undefined bounds gracefully', () => {
  render(<MapLibre {...defaultProps} bounds={undefined} />);
  expect(lastMapProps.longitude).toBe(0);
  expect(lastMapProps.latitude).toBe(0);
  expect(lastMapProps.zoom).toBe(1);
});

test('applies partial viewport props on update', () => {
  const { rerender } = render(<MapLibre {...defaultProps} />);

  rerender(<MapLibre {...defaultProps} viewportLongitude={-122.4} />);

  expect(lastMapProps.longitude).toBe(-122.4);
  // lat and zoom come from fitBounds
  expect(lastMapProps.latitude).toBe(40.75);
  expect(lastMapProps.zoom).toBe(10.86);
});

test('restores fitBounds when viewport props are cleared', () => {
  const { rerender } = render(
    <MapLibre
      {...defaultProps}
      viewportLongitude={-122.4}
      viewportLatitude={37.8}
      viewportZoom={5}
    />,
  );

  // Clear all viewport props
  rerender(<MapLibre {...defaultProps} />);

  // Should revert to fitBounds values
  expect(lastMapProps.longitude).toBe(-73.95);
  expect(lastMapProps.latitude).toBe(40.75);
  expect(lastMapProps.zoom).toBe(10.86);
});

test('restores only cleared viewport props, keeps the rest', () => {
  const { rerender } = render(
    <MapLibre
      {...defaultProps}
      viewportLongitude={-122.4}
      viewportLatitude={37.8}
      viewportZoom={5}
    />,
  );

  // Clear only longitude, keep lat/zoom
  rerender(
    <MapLibre {...defaultProps} viewportLatitude={37.8} viewportZoom={5} />,
  );

  // Longitude reverts to fitBounds, lat/zoom stay
  expect(lastMapProps.longitude).toBe(-73.95);
  expect(lastMapProps.latitude).toBe(37.8);
  expect(lastMapProps.zoom).toBe(5);
});

test('falls back to default viewport when cleared with undefined bounds', () => {
  const { rerender } = render(
    <MapLibre
      {...defaultProps}
      bounds={undefined}
      viewportLongitude={-122.4}
      viewportLatitude={37.8}
      viewportZoom={5}
    />,
  );

  // Clear viewport props — no bounds to fitBounds to
  rerender(<MapLibre {...defaultProps} bounds={undefined} />);

  // Should fall back to {0, 0, 1}
  expect(lastMapProps.longitude).toBe(0);
  expect(lastMapProps.latitude).toBe(0);
  expect(lastMapProps.zoom).toBe(1);
});
