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
import MapBox from '../src/MapBox';

// Capture the most recent viewport props passed to MapGL
let lastMapGLProps: Record<string, unknown> = {};
const mockFitBounds = jest.fn();

jest.mock('react-map-gl', () => {
  const MockMapGL = (props: Record<string, unknown>) => {
    lastMapGLProps = props;
    return <div data-test="map-gl">{props.children as ReactNode}</div>;
  };
  return { __esModule: true, default: MockMapGL };
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

jest.mock('../src/ScatterPlotGlowOverlay', () => {
  const MockOverlay = (props: Record<string, unknown>) => (
    <div data-test="scatter-overlay" data-opacity={props.globalOpacity} />
  );
  return { __esModule: true, default: MockOverlay };
});

const defaultProps = {
  width: 800,
  height: 600,
  clusterer: {
    getClusters: jest.fn().mockReturnValue([]),
  },
  globalOpacity: 1,
  mapboxApiKey: 'test-key',
  mapStyle: 'mapbox://styles/mapbox/light-v9',
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
  lastMapGLProps = {};
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
  render(<MapBox {...defaultProps} />);
  expect(lastMapGLProps.latitude).toBe(40.75);
  expect(lastMapGLProps.longitude).toBe(-73.95);
  expect(lastMapGLProps.zoom).toBe(10.86);
});

test('updates viewport when viewport props change', () => {
  const { rerender } = render(
    <MapBox
      {...defaultProps}
      viewportLongitude={-73.95}
      viewportLatitude={40.75}
      viewportZoom={10}
    />,
  );

  rerender(
    <MapBox
      {...defaultProps}
      viewportLongitude={-122.4}
      viewportLatitude={37.8}
      viewportZoom={5}
    />,
  );

  expect(lastMapGLProps.longitude).toBe(-122.4);
  expect(lastMapGLProps.latitude).toBe(37.8);
  expect(lastMapGLProps.zoom).toBe(5);
});

test('does not loop when viewport state matches new props', () => {
  const { rerender } = render(
    <MapBox
      {...defaultProps}
      viewportLongitude={-73.95}
      viewportLatitude={40.75}
      viewportZoom={10}
    />,
  );

  // Re-render with same props that match the initial viewport state
  rerender(
    <MapBox
      {...defaultProps}
      viewportLongitude={-73.95}
      viewportLatitude={40.75}
      viewportZoom={10}
    />,
  );

  // Viewport should still be the fitBounds-computed values since props didn't change
  expect(lastMapGLProps.longitude).toBe(-73.95);
  expect(lastMapGLProps.latitude).toBe(40.75);
  expect(lastMapGLProps.zoom).toBe(10);
});

test('passes globalOpacity to ScatterPlotGlowOverlay', () => {
  const { getByTestId } = render(
    <MapBox {...defaultProps} globalOpacity={0.5} />,
  );
  const overlay = getByTestId('scatter-overlay');
  expect(overlay.dataset.opacity).toBe('0.5');
});

test('initializes viewport from props when provided', () => {
  render(
    <MapBox
      {...defaultProps}
      viewportLongitude={-122.4}
      viewportLatitude={37.8}
      viewportZoom={5}
    />,
  );
  expect(lastMapGLProps.longitude).toBe(-122.4);
  expect(lastMapGLProps.latitude).toBe(37.8);
  expect(lastMapGLProps.zoom).toBe(5);
});

test('handles undefined bounds gracefully', () => {
  render(<MapBox {...defaultProps} bounds={undefined} />);
  expect(lastMapGLProps.longitude).toBe(0);
  expect(lastMapGLProps.latitude).toBe(0);
  expect(lastMapGLProps.zoom).toBe(1);
});

test('applies partial viewport props on update', () => {
  const { rerender } = render(<MapBox {...defaultProps} />);

  rerender(<MapBox {...defaultProps} viewportLongitude={-122.4} />);

  expect(lastMapGLProps.longitude).toBe(-122.4);
  expect(lastMapGLProps.latitude).toBe(40.75);
  expect(lastMapGLProps.zoom).toBe(10.86);
});

test('restores fitBounds when viewport props are cleared', () => {
  const { rerender } = render(
    <MapBox
      {...defaultProps}
      viewportLongitude={-122.4}
      viewportLatitude={37.8}
      viewportZoom={5}
    />,
  );

  // Clear all viewport props (simulates user clearing the controls)
  rerender(<MapBox {...defaultProps} />);

  // Should revert to fitBounds values
  expect(lastMapGLProps.longitude).toBe(-73.95);
  expect(lastMapGLProps.latitude).toBe(40.75);
  expect(lastMapGLProps.zoom).toBe(10.86);
});

test('restores only cleared viewport props, keeps the rest', () => {
  const { rerender } = render(
    <MapBox
      {...defaultProps}
      viewportLongitude={-122.4}
      viewportLatitude={37.8}
      viewportZoom={5}
    />,
  );

  // Clear only longitude, keep lat/zoom
  rerender(
    <MapBox {...defaultProps} viewportLatitude={37.8} viewportZoom={5} />,
  );

  // Longitude reverts to fitBounds, lat/zoom stay
  expect(lastMapGLProps.longitude).toBe(-73.95);
  expect(lastMapGLProps.latitude).toBe(37.8);
  expect(lastMapGLProps.zoom).toBe(5);
});

test('applies changed viewport props even when another is cleared simultaneously', () => {
  const { rerender } = render(
    <MapBox
      {...defaultProps}
      viewportLongitude={-122.4}
      viewportLatitude={37.8}
      viewportZoom={5}
    />,
  );

  // Clear longitude, change latitude simultaneously
  rerender(
    <MapBox {...defaultProps} viewportLatitude={40.0} viewportZoom={5} />,
  );

  // Longitude reverts to fitBounds, latitude should be the NEW value
  expect(lastMapGLProps.longitude).toBe(-73.95);
  expect(lastMapGLProps.latitude).toBe(40.0);
  expect(lastMapGLProps.zoom).toBe(5);
});

test('falls back to default viewport when cleared with undefined bounds', () => {
  const { rerender } = render(
    <MapBox
      {...defaultProps}
      bounds={undefined}
      viewportLongitude={-122.4}
      viewportLatitude={37.8}
      viewportZoom={5}
    />,
  );

  // Clear viewport props — no bounds to fitBounds to
  rerender(<MapBox {...defaultProps} bounds={undefined} />);

  // Should fall back to {0, 0, 1}
  expect(lastMapGLProps.longitude).toBe(0);
  expect(lastMapGLProps.latitude).toBe(0);
  expect(lastMapGLProps.zoom).toBe(1);
});

test('recomputes fitBounds when bounds change and no explicit viewport is set', () => {
  const { rerender } = render(<MapBox {...defaultProps} />);

  rerender(
    <MapBox
      {...defaultProps}
      bounds={[
        [-123.2, 36.5],
        [-121.8, 38.1],
      ]}
    />,
  );

  expect(lastMapGLProps.longitude).toBe(-122.5);
  expect(lastMapGLProps.latitude).toBe(37.3);
  expect(lastMapGLProps.zoom).toBe(10.86);
});

test('recomputes fitBounds when chart size changes and no explicit viewport is set', () => {
  const { rerender } = render(<MapBox {...defaultProps} />);

  rerender(<MapBox {...defaultProps} width={1200} height={900} />);

  expect(lastMapGLProps.longitude).toBe(-73.95);
  expect(lastMapGLProps.latitude).toBe(40.75);
  expect(lastMapGLProps.zoom).toBe(11.29);
});

test('recomputes only implicit viewport fields when bounds change', () => {
  const { rerender } = render(
    <MapBox {...defaultProps} viewportLongitude={-122.4} />,
  );

  rerender(
    <MapBox
      {...defaultProps}
      viewportLongitude={-122.4}
      bounds={[
        [-123.2, 36.5],
        [-121.8, 38.1],
      ]}
    />,
  );

  expect(lastMapGLProps.longitude).toBe(-122.4);
  expect(lastMapGLProps.latitude).toBe(37.3);
  expect(lastMapGLProps.zoom).toBe(10.86);
});

test('recomputes only implicit viewport fields when chart size changes', () => {
  const { rerender } = render(
    <MapBox {...defaultProps} viewportLatitude={37.8} />,
  );

  rerender(
    <MapBox
      {...defaultProps}
      viewportLatitude={37.8}
      width={1200}
      height={900}
    />,
  );

  expect(lastMapGLProps.longitude).toBe(-73.95);
  expect(lastMapGLProps.latitude).toBe(37.8);
  expect(lastMapGLProps.zoom).toBe(11.29);
});

test('recomputes implicit position when zoom stays explicit across bounds changes', () => {
  const { rerender } = render(<MapBox {...defaultProps} viewportZoom={5} />);

  rerender(
    <MapBox
      {...defaultProps}
      viewportZoom={5}
      bounds={[
        [-123.2, 36.5],
        [-121.8, 38.1],
      ]}
    />,
  );

  expect(lastMapGLProps.longitude).toBe(-122.5);
  expect(lastMapGLProps.latitude).toBe(37.3);
  expect(lastMapGLProps.zoom).toBe(5);
});

test('does not recompute fitBounds on bounds change when an explicit viewport is set', () => {
  const { rerender } = render(
    <MapBox
      {...defaultProps}
      viewportLongitude={-122.4}
      viewportLatitude={37.8}
      viewportZoom={5}
    />,
  );

  rerender(
    <MapBox
      {...defaultProps}
      viewportLongitude={-122.4}
      viewportLatitude={37.8}
      viewportZoom={5}
      bounds={[
        [-123.2, 36.5],
        [-121.8, 38.1],
      ]}
    />,
  );

  expect(lastMapGLProps.longitude).toBe(-122.4);
  expect(lastMapGLProps.latitude).toBe(37.8);
  expect(lastMapGLProps.zoom).toBe(5);
});
