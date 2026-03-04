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

import { render } from '@testing-library/react';
import MapBox from '../src/MapBox';

// Capture the most recent viewport props passed to MapGL
let lastMapGLProps: Record<string, unknown> = {};

jest.mock('react-map-gl', () => {
  const MockMapGL = (props: Record<string, unknown>) => {
    lastMapGLProps = props;
    return <div data-testid="map-gl">{props.children as React.ReactNode}</div>;
  };
  return { __esModule: true, default: MockMapGL };
});

jest.mock('@math.gl/web-mercator', () => ({
  WebMercatorViewport: jest.fn().mockImplementation(() => ({
    fitBounds: jest.fn().mockReturnValue({
      latitude: 40.75,
      longitude: -73.95,
      zoom: 10,
    }),
  })),
}));

jest.mock('../src/ScatterPlotGlowOverlay', () => {
  const MockOverlay = (props: Record<string, unknown>) => (
    <div data-testid="scatter-overlay" data-opacity={props.globalOpacity} />
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
});

test('initializes viewport from bounds', () => {
  render(<MapBox {...defaultProps} />);
  expect(lastMapGLProps.latitude).toBe(40.75);
  expect(lastMapGLProps.longitude).toBe(-73.95);
  expect(lastMapGLProps.zoom).toBe(10);
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
