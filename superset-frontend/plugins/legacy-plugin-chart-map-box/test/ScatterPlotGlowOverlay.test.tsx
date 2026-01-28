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
import ScatterPlotGlowOverlay from '../src/ScatterPlotGlowOverlay';

// Mock react-map-gl's CanvasOverlay
jest.mock('react-map-gl', () => ({
  CanvasOverlay: ({ redraw }: { redraw: Function }) => {
    // Store the redraw function so tests can call it
    (global as any).mockRedraw = redraw;
    return <div data-testid="canvas-overlay" />;
  },
}));

// Mock utility functions
jest.mock('../src/utils/luminanceFromRGB', () => ({
  __esModule: true,
  default: jest.fn(() => 150), // Return a value above the dark threshold
}));

// Test helpers
const createMockCanvas = () => {
  const ctx: any = {
    clearRect: jest.fn(),
    beginPath: jest.fn(),
    arc: jest.fn(),
    fill: jest.fn(),
    fillText: jest.fn(),
    measureText: jest.fn(() => ({ width: 10 })),
    createRadialGradient: jest.fn(() => ({
      addColorStop: jest.fn(),
    })),
    globalCompositeOperation: '',
    fillStyle: '',
    font: '',
    textAlign: '',
    textBaseline: '',
    shadowBlur: 0,
    shadowColor: '',
  };

  return ctx;
};

const createMockRedrawParams = (overrides = {}) => ({
  width: 800,
  height: 600,
  ctx: createMockCanvas(),
  isDragging: false,
  project: (lngLat: [number, number]) => lngLat,
  ...overrides,
});

const createLocation = (
  coordinates: [number, number],
  properties: Record<string, any>,
) => ({
  geometry: { coordinates },
  properties,
});

const defaultProps = {
  lngLatAccessor: (loc: any) => loc.geometry.coordinates,
  dotRadius: 60,
  rgb: ['', 255, 0, 0] as any,
  globalOpacity: 1,
};

test('renders map with varying radius values in Pixels mode', () => {
  const locations = [
    createLocation([100, 100], { radius: 10, cluster: false }),
    createLocation([200, 200], { radius: 50, cluster: false }),
    createLocation([300, 300], { radius: 100, cluster: false }),
  ];

  expect(() => {
    render(
      <ScatterPlotGlowOverlay
        {...defaultProps}
        locations={locations}
        pointRadiusUnit="Pixels"
      />,
    );
    const redrawParams = createMockRedrawParams();
    (global as any).mockRedraw(redrawParams);
  }).not.toThrow();
});

test('handles dataset with uniform radius values', () => {
  const locations = [
    createLocation([100, 100], { radius: 50, cluster: false }),
    createLocation([200, 200], { radius: 50, cluster: false }),
    createLocation([300, 300], { radius: 50, cluster: false }),
  ];

  expect(() => {
    render(
      <ScatterPlotGlowOverlay
        {...defaultProps}
        locations={locations}
        pointRadiusUnit="Pixels"
      />,
    );
    const redrawParams = createMockRedrawParams();
    (global as any).mockRedraw(redrawParams);
  }).not.toThrow();
});

test('renders successfully when data contains non-finite values', () => {
  const locations = [
    createLocation([100, 100], { radius: 10, cluster: false }),
    createLocation([200, 200], { radius: NaN, cluster: false }),
    createLocation([300, 300], { radius: 100, cluster: false }),
  ];

  expect(() => {
    render(
      <ScatterPlotGlowOverlay
        {...defaultProps}
        locations={locations}
        pointRadiusUnit="Pixels"
      />,
    );
    const redrawParams = createMockRedrawParams();
    (global as any).mockRedraw(redrawParams);
  }).not.toThrow();
});

test('handles radius values provided as strings', () => {
  const locations = [
    createLocation([100, 100], { radius: '10', cluster: false }),
    createLocation([200, 200], { radius: '50', cluster: false }),
    createLocation([300, 300], { radius: '100', cluster: false }),
  ];

  expect(() => {
    render(
      <ScatterPlotGlowOverlay
        {...defaultProps}
        locations={locations}
        pointRadiusUnit="Pixels"
      />,
    );
    const redrawParams = createMockRedrawParams();
    (global as any).mockRedraw(redrawParams);
  }).not.toThrow();
});

test('renders points when radius values are missing', () => {
  const locations = [
    createLocation([100, 100], { radius: null, cluster: false }),
    createLocation([200, 200], { radius: undefined, cluster: false }),
    createLocation([300, 300], { cluster: false }),
  ];

  expect(() => {
    render(
      <ScatterPlotGlowOverlay
        {...defaultProps}
        locations={locations}
        pointRadiusUnit="Pixels"
      />,
    );
    const redrawParams = createMockRedrawParams();
    (global as any).mockRedraw(redrawParams);
  }).not.toThrow();
});

test('renders both cluster and non-cluster points correctly', () => {
  const locations = [
    createLocation([100, 100], { radius: 10, cluster: false }),
    createLocation([200, 200], {
      radius: 999,
      cluster: true,
      point_count: 5,
      sum: 100,
    }),
    createLocation([300, 300], { radius: 100, cluster: false }),
  ];

  expect(() => {
    render(
      <ScatterPlotGlowOverlay
        {...defaultProps}
        locations={locations}
        pointRadiusUnit="Pixels"
      />,
    );
    const redrawParams = createMockRedrawParams();
    (global as any).mockRedraw(redrawParams);
  }).not.toThrow();
});

test('renders map with multiple points with different radius values', () => {
  const locations = [
    createLocation([100, 100], { radius: 10, cluster: false }),
    createLocation([200, 200], { radius: 42.567, cluster: false }),
    createLocation([300, 300], { radius: 100, cluster: false }),
  ];

  expect(() => {
    render(
      <ScatterPlotGlowOverlay
        {...defaultProps}
        locations={locations}
        pointRadiusUnit="Pixels"
      />,
    );
    const redrawParams = createMockRedrawParams();
    (global as any).mockRedraw(redrawParams);
  }).not.toThrow();
});

test('renders map with Kilometers mode', () => {
  const locations = [
    createLocation([100, 50], { radius: 10, cluster: false }),
    createLocation([200, 50], { radius: 5, cluster: false }),
  ];

  expect(() => {
    render(
      <ScatterPlotGlowOverlay
        {...defaultProps}
        locations={locations}
        pointRadiusUnit="Kilometers"
        zoom={10}
      />,
    );
    const redrawParams = createMockRedrawParams();
    (global as any).mockRedraw(redrawParams);
  }).not.toThrow();
});

test('renders map with Miles mode', () => {
  const locations = [
    createLocation([100, 50], { radius: 5, cluster: false }),
    createLocation([200, 50], { radius: 10, cluster: false }),
  ];

  expect(() => {
    render(
      <ScatterPlotGlowOverlay
        {...defaultProps}
        locations={locations}
        pointRadiusUnit="Miles"
        zoom={10}
      />,
    );
    const redrawParams = createMockRedrawParams();
    (global as any).mockRedraw(redrawParams);
  }).not.toThrow();
});

test('displays metric property labels on points', () => {
  const locations = [
    createLocation([100, 100], { radius: 50, metric: 123.456, cluster: false }),
  ];

  expect(() => {
    render(
      <ScatterPlotGlowOverlay
        {...defaultProps}
        locations={locations}
        pointRadiusUnit="Pixels"
      />,
    );
    const redrawParams = createMockRedrawParams();
    (global as any).mockRedraw(redrawParams);
  }).not.toThrow();
});

test('handles empty dataset without errors', () => {
  expect(() => {
    render(
      <ScatterPlotGlowOverlay
        {...defaultProps}
        locations={[]}
        pointRadiusUnit="Pixels"
      />,
    );
    const redrawParams = createMockRedrawParams();
    (global as any).mockRedraw(redrawParams);
  }).not.toThrow();
});

test('handles extreme outlier radius values without breaking', () => {
  const locations = [
    createLocation([100, 100], { radius: 1, cluster: false }),
    createLocation([200, 200], { radius: 50, cluster: false }),
    createLocation([300, 300], { radius: 999999, cluster: false }),
  ];

  expect(() => {
    render(
      <ScatterPlotGlowOverlay
        {...defaultProps}
        locations={locations}
        pointRadiusUnit="Pixels"
      />,
    );
    const redrawParams = createMockRedrawParams();
    (global as any).mockRedraw(redrawParams);
  }).not.toThrow();
});

test('renders successfully with mixed extreme and negative radius values', () => {
  const locations = [
    createLocation([100, 100], { radius: 0.001, cluster: false }),
    createLocation([150, 150], { radius: 5, cluster: false }),
    createLocation([200, 200], { radius: 100, cluster: false }),
    createLocation([250, 250], { radius: 50000, cluster: false }),
    createLocation([300, 300], { radius: -10, cluster: false }),
  ];

  expect(() => {
    render(
      <ScatterPlotGlowOverlay
        {...defaultProps}
        locations={locations}
        pointRadiusUnit="Pixels"
      />,
    );
  }).not.toThrow();

  expect(() => {
    const redrawParams = createMockRedrawParams();
    (global as any).mockRedraw(redrawParams);
  }).not.toThrow();
});
