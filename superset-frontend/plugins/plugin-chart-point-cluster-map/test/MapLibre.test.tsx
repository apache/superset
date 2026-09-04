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
import { render } from '@testing-library/react';

// Capture the most recent viewport props passed to the Map component
let lastMapProps: Record<string, unknown> = {};
const mockFitBounds = jest.fn();

jest.mock('react-map-gl/maplibre', () => {
  const MockMap = (props: Record<string, unknown>) => {
    lastMapProps = props;
    return <div data-testid="map-gl">{props.children as ReactNode}</div>;
  };
  return { __esModule: true, Map: MockMap };
});

jest.mock('react-map-gl/mapbox', () => {
  const MockMap = (props: Record<string, unknown>) => {
    lastMapProps = props;
    return <div data-testid="map-gl">{props.children as ReactNode}</div>;
  };
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
    <div data-testid="scatter-overlay" data-opacity={props.globalOpacity} />
  );
  return { __esModule: true, default: MockOverlay };
});

jest.mock('@apache-superset/core/theme', () => ({
  useTheme: () => ({ colorTextSecondary: '#666' }),
}));

jest.mock('maplibre-gl/dist/maplibre-gl.css', () => ({}));
jest.mock('../src/MapLibre.css', () => ({}));

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

beforeEach(() => {
  lastMapProps = {};
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
