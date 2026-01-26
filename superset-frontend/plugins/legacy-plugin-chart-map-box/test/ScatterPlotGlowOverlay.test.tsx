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

const renderAndRedraw = (props: any) => {
  render(<ScatterPlotGlowOverlay {...defaultProps} {...props} />);
  const redrawParams = createMockRedrawParams();
  (global as any).mockRedraw(redrawParams);
  return redrawParams;
};

const getArcRadii = (ctx: any) =>
  ctx.arc.mock.calls.map((call: any) => call[2]);

test('redraw with Pixels mode normalizes radius values correctly', () => {
  const locations = [
    createLocation([100, 100], { radius: 10, cluster: false }),
    createLocation([200, 200], { radius: 50, cluster: false }),
    createLocation([300, 300], { radius: 100, cluster: false }),
  ];

  const { ctx } = renderAndRedraw({ locations, pointRadiusUnit: 'Pixels' });

  // Verify arc was called 3 times (once per point)
  expect(ctx.arc).toHaveBeenCalledTimes(3);

  // MIN_POINT_RADIUS = dotRadius/6 = 10, MAX_POINT_RADIUS = dotRadius/3 = 20
  // Values: 10, 50, 100
  // Normalized: (10-10)/(100-10) = 0, (50-10)/(100-10) = 0.444, (100-10)/(100-10) = 1
  // Scaled: 10 + 0*(20-10) = 10, 10 + 0.444*10 = 14.44, 10 + 1*10 = 20
  const radiusCalls = getArcRadii(ctx);
  expect(radiusCalls[0]).toBeCloseTo(10, 1);
  expect(radiusCalls[1]).toBeCloseTo(14.4, 1);
  expect(radiusCalls[2]).toBeCloseTo(20, 1);
});

test('redraw with Pixels mode handles all same values', () => {
  const locations = [
    createLocation([100, 100], { radius: 50, cluster: false }),
    createLocation([200, 200], { radius: 50, cluster: false }),
    createLocation([300, 300], { radius: 50, cluster: false }),
  ];

  const { ctx } = renderAndRedraw({ locations, pointRadiusUnit: 'Pixels' });

  // MIN_POINT_RADIUS = 10, MAX_POINT_RADIUS = 20
  // All same values should use fixed medium size: (10 + 20) / 2 = 15
  const radiusCalls = getArcRadii(ctx);
  radiusCalls.forEach((radius: number) => {
    expect(radius).toBeCloseTo(15, 1);
  });
});

test('redraw with Pixels mode handles non-finite values', () => {
  const locations = [
    createLocation([100, 100], { radius: 10, cluster: false }),
    createLocation([200, 200], { radius: NaN, cluster: false }),
    createLocation([300, 300], { radius: 100, cluster: false }),
  ];

  const { ctx } = renderAndRedraw({ locations, pointRadiusUnit: 'Pixels' });

  // Non-finite value (NaN) should use MIN_POINT_RADIUS = dotRadius/6 = 10
  const radiusCalls = getArcRadii(ctx);
  expect(radiusCalls[1]).toBe(10);
});

test('redraw with Pixels mode coerces numeric strings', () => {
  const locations = [
    createLocation([100, 100], { radius: '10', cluster: false }),
    createLocation([200, 200], { radius: '50', cluster: false }),
    createLocation([300, 300], { radius: '100', cluster: false }),
  ];

  const { ctx } = renderAndRedraw({ locations, pointRadiusUnit: 'Pixels' });

  // Should successfully render all 3 points with coerced numeric values
  expect(ctx.arc).toHaveBeenCalledTimes(3);

  // Values should be normalized correctly from string '10', '50', '100'
  const radiusCalls = getArcRadii(ctx);
  expect(radiusCalls[0]).toBeCloseTo(10, 1);
  expect(radiusCalls[1]).toBeCloseTo(14.4, 1);
  expect(radiusCalls[2]).toBeCloseTo(20, 1);
});

test('redraw with Pixels mode handles null and undefined radius values', () => {
  const locations = [
    createLocation([100, 100], { radius: null, cluster: false }),
    createLocation([200, 200], { radius: undefined, cluster: false }),
    createLocation([300, 300], { cluster: false }),
  ];

  const { ctx } = renderAndRedraw({ locations, pointRadiusUnit: 'Pixels' });

  // All null/undefined values should use defaultRadius = dotRadius / 6 = 10
  const radiusCalls = getArcRadii(ctx);
  radiusCalls.forEach((radius: number) => {
    expect(radius).toBe(10);
  });
});

test('redraw with Pixels mode ignores cluster points when calculating min/max', () => {
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

  const { ctx } = renderAndRedraw({ locations, pointRadiusUnit: 'Pixels' });

  // arc is called for 2 non-cluster points + 1 cluster point = 3 times
  expect(ctx.arc).toHaveBeenCalledTimes(3);

  // First and third calls should be normalized based on min=10, max=100
  // (ignoring the cluster point with radius=999)
  const radiusCalls = getArcRadii(ctx);
  expect(radiusCalls[0]).toBeCloseTo(10, 1);
  expect(radiusCalls[2]).toBeCloseTo(20, 1);
});

test('redraw with Pixels mode renders all points with radius values', () => {
  const locations = [
    createLocation([100, 100], { radius: 10, cluster: false }),
    createLocation([200, 200], { radius: 42.567, cluster: false }),
    createLocation([300, 300], { radius: 100, cluster: false }),
  ];

  const { ctx } = renderAndRedraw({ locations, pointRadiusUnit: 'Pixels' });

  // All three points should be rendered
  expect(ctx.arc).toHaveBeenCalledTimes(3);
  expect(ctx.fill).toHaveBeenCalledTimes(3);
});

test('redraw with Kilometers mode still works correctly', () => {
  const locations = [
    createLocation([100, 50], { radius: 10, cluster: false }),
    createLocation([200, 50], { radius: 5, cluster: false }),
  ];

  const { ctx } = renderAndRedraw({
    locations,
    pointRadiusUnit: 'Kilometers',
    zoom: 10,
  });

  // Should render both points with Kilometers mode
  expect(ctx.arc).toHaveBeenCalledTimes(2);
  expect(ctx.fill).toHaveBeenCalledTimes(2);
});

test('redraw with Miles mode still works correctly', () => {
  const locations = [
    createLocation([100, 50], { radius: 5, cluster: false }),
    createLocation([200, 50], { radius: 10, cluster: false }),
  ];

  const { ctx } = renderAndRedraw({
    locations,
    pointRadiusUnit: 'Miles',
    zoom: 10,
  });

  // Should render both points with Miles mode
  expect(ctx.arc).toHaveBeenCalledTimes(2);
  expect(ctx.fill).toHaveBeenCalledTimes(2);
});

test('redraw with metric property overrides radius label', () => {
  const locations = [
    createLocation([100, 100], { radius: 50, metric: 123.456, cluster: false }),
  ];

  const { ctx } = renderAndRedraw({ locations, pointRadiusUnit: 'Pixels' });

  // metric property should override the radius label (returns a number, not string)
  expect(ctx.fillText).toHaveBeenCalledWith(
    123.46,
    expect.any(Number),
    expect.any(Number),
  );
});

test('redraw with empty locations array renders nothing', () => {
  const { ctx } = renderAndRedraw({ locations: [], pointRadiusUnit: 'Pixels' });

  // Should clear canvas but not render any points
  expect(ctx.clearRect).toHaveBeenCalled();
  expect(ctx.arc).not.toHaveBeenCalled();
});
