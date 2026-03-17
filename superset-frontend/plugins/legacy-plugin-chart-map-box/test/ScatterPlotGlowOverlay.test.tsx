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

type MockGradient = {
  addColorStop: jest.Mock<void, [number, string]>;
};

type MockCanvasContext = {
  clearRect: jest.Mock<void, [number, number, number, number]>;
  beginPath: jest.Mock<void, []>;
  arc: jest.Mock<void, [number, number, number, number, number]>;
  fill: jest.Mock<void, []>;
  fillText: jest.Mock<void, [string, number, number]>;
  measureText: jest.Mock<{ width: number }, [string]>;
  createRadialGradient: jest.Mock<
    MockGradient,
    [number, number, number, number, number, number]
  >;
  globalCompositeOperation: string;
  fillStyle: string | CanvasGradient;
  font: string;
  textAlign: CanvasTextAlign;
  textBaseline: CanvasTextBaseline;
  shadowBlur: number;
  shadowColor: string;
};

type LocationProperties = Record<
  string,
  number | string | boolean | null | undefined
>;

type TestLocation = {
  geometry: { coordinates: [number, number] };
  properties: LocationProperties;
};

type MockRedrawParams = {
  width: number;
  height: number;
  ctx: MockCanvasContext;
  isDragging: boolean;
  project: (lngLat: [number, number]) => [number, number];
};

declare global {
  // eslint-disable-next-line no-var
  var mockRedraw: unknown;
}

// Mock react-map-gl's CanvasOverlay
jest.mock('react-map-gl', () => ({
  CanvasOverlay: ({ redraw }: { redraw: unknown }) => {
    // Store the redraw function so tests can call it
    global.mockRedraw = redraw;
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
  const ctx: MockCanvasContext = {
    clearRect: jest.fn(),
    beginPath: jest.fn(),
    arc: jest.fn(),
    fill: jest.fn(),
    fillText: jest.fn(),
    measureText: jest.fn((_: string) => ({ width: 10 })),
    createRadialGradient: jest.fn(
      (
        _x0: number,
        _y0: number,
        _r0: number,
        _x1: number,
        _y1: number,
        _r1: number,
      ) => ({
        addColorStop: jest.fn<void, [number, string]>(),
      }),
    ),
    globalCompositeOperation: '',
    fillStyle: '',
    font: '',
    textAlign: 'center',
    textBaseline: 'middle',
    shadowBlur: 0,
    shadowColor: '',
  };

  return ctx;
};

const createMockRedrawParams = (
  overrides: Partial<MockRedrawParams> = {},
): MockRedrawParams => ({
  width: 800,
  height: 600,
  ctx: createMockCanvas(),
  isDragging: false,
  project: (lngLat: [number, number]) => lngLat,
  ...overrides,
});

const createLocation = (
  coordinates: [number, number],
  properties: LocationProperties,
): TestLocation => ({
  geometry: { coordinates },
  properties,
});

const triggerRedraw = (
  overrides: Partial<MockRedrawParams> = {},
): MockRedrawParams => {
  const redrawParams = createMockRedrawParams(overrides);
  if (typeof global.mockRedraw !== 'function') {
    throw new Error('CanvasOverlay redraw callback was not registered');
  }
  (global.mockRedraw as (params: MockRedrawParams) => void)(redrawParams);
  return redrawParams;
};

const defaultProps = {
  lngLatAccessor: (loc: TestLocation) => loc.geometry.coordinates,
  dotRadius: 60,
  rgb: ['', 255, 0, 0] as [string, number, number, number],
  globalOpacity: 1,
};
const MIN_VISIBLE_POINT_RADIUS = 10;
const MAX_VISIBLE_POINT_RADIUS = 20;

test('renders map with varying radius values in Pixels mode', () => {
  const locations = [
    createLocation([100, 100], { radius: 10, cluster: false }),
    createLocation([200, 200], { radius: 50, cluster: false }),
    createLocation([300, 300], { radius: 100, cluster: false }),
  ];

  render(
    <ScatterPlotGlowOverlay
      {...defaultProps}
      locations={locations}
      pointRadiusUnit="Pixels"
    />,
  );
  const redrawParams = triggerRedraw();

  const arcCalls = redrawParams.ctx.arc.mock.calls;

  // With dotRadius=60, pixel-sized points should map to the visible 10-20 range.
  arcCalls.forEach(call => {
    expect(call[2]).toBeGreaterThanOrEqual(MIN_VISIBLE_POINT_RADIUS);
    expect(call[2]).toBeLessThanOrEqual(MAX_VISIBLE_POINT_RADIUS);
  });

  // Ordering should be preserved: radius 10 < 50 < 100
  expect(arcCalls[0][2]).toBeLessThan(arcCalls[1][2]);
  expect(arcCalls[1][2]).toBeLessThan(arcCalls[2][2]);
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
    triggerRedraw();
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
    triggerRedraw();
  }).not.toThrow();
});

test('handles radius values provided as strings', () => {
  const locations = [
    createLocation([100, 100], { radius: '10', cluster: false }),
    createLocation([200, 200], { radius: '50', cluster: false }),
    createLocation([300, 300], { radius: '100', cluster: false }),
  ];

  render(
    <ScatterPlotGlowOverlay
      {...defaultProps}
      locations={locations}
      pointRadiusUnit="Pixels"
    />,
  );
  const redrawParams = triggerRedraw();

  const arcCalls = redrawParams.ctx.arc.mock.calls;

  arcCalls.forEach(call => {
    expect(call[2]).toBeGreaterThanOrEqual(MIN_VISIBLE_POINT_RADIUS);
    expect(call[2]).toBeLessThanOrEqual(MAX_VISIBLE_POINT_RADIUS);
  });

  expect(arcCalls[0][2]).toBeLessThan(arcCalls[1][2]);
  expect(arcCalls[1][2]).toBeLessThan(arcCalls[2][2]);
});

test('treats blank radius strings as missing values', () => {
  const locations = [
    createLocation([100, 100], { radius: '', cluster: false }),
    createLocation([200, 200], { radius: '   ', cluster: false }),
    createLocation([300, 300], { radius: '100', cluster: false }),
  ];

  render(
    <ScatterPlotGlowOverlay
      {...defaultProps}
      locations={locations}
      pointRadiusUnit="Pixels"
    />,
  );
  const redrawParams = triggerRedraw();

  const arcCalls = redrawParams.ctx.arc.mock.calls;

  expect(arcCalls[0][2]).toBe(MIN_VISIBLE_POINT_RADIUS);
  expect(arcCalls[1][2]).toBe(MIN_VISIBLE_POINT_RADIUS);
  expect(arcCalls[2][2]).toBe(15);
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
    triggerRedraw();
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
    triggerRedraw();
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
    triggerRedraw();
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
    triggerRedraw();
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
    triggerRedraw();
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
    triggerRedraw();
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
    triggerRedraw();
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
    triggerRedraw();
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
    triggerRedraw();
  }).not.toThrow();
});

test('cluster radius is always >= max individual point radius in Pixels mode', () => {
  const locations = [
    createLocation([100, 100], {
      cluster: true,
      point_count: 2,
      sum: 1,
    }),
    createLocation([200, 200], { cluster: false, radius: 1 }),
    createLocation([300, 300], { cluster: false, radius: 100 }),
  ];

  render(
    <ScatterPlotGlowOverlay
      {...defaultProps}
      locations={locations}
      aggregation="sum"
      pointRadiusUnit="Pixels"
    />,
  );
  const redrawParams = triggerRedraw();

  const arcCalls = redrawParams.ctx.arc.mock.calls;

  // cluster with label=1 (index 0) should not be smaller than the largest point bubble
  expect(arcCalls[0][2]).toBeGreaterThanOrEqual(MAX_VISIBLE_POINT_RADIUS);
  // point radii span the configured pixel range
  expect(arcCalls[1][2]).toBe(MIN_VISIBLE_POINT_RADIUS);
  expect(arcCalls[2][2]).toBe(MAX_VISIBLE_POINT_RADIUS);
  expect(arcCalls[0][2]).toBeGreaterThanOrEqual(arcCalls[2][2]);
});

test('largest cluster gets full dotRadius', () => {
  const locations = [
    createLocation([100, 100], {
      cluster: true,
      point_count: 10,
      sum: 50,
    }),
    createLocation([200, 200], {
      cluster: true,
      point_count: 50,
      sum: 100,
    }),
  ];

  render(
    <ScatterPlotGlowOverlay
      {...defaultProps}
      locations={locations}
      aggregation="sum"
      pointRadiusUnit="Pixels"
    />,
  );
  const redrawParams = triggerRedraw();

  const arcCalls = redrawParams.ctx.arc.mock.calls;
  // The largest cluster (label=100, maxLabel=100) should get full radius
  expect(arcCalls[1][2]).toBe(defaultProps.dotRadius);
});

test('cluster radii preserve proportional ordering', () => {
  const locations = [
    createLocation([100, 100], {
      cluster: true,
      point_count: 5,
      sum: 10,
    }),
    createLocation([200, 200], {
      cluster: true,
      point_count: 25,
      sum: 50,
    }),
    createLocation([300, 300], {
      cluster: true,
      point_count: 50,
      sum: 100,
    }),
  ];

  render(
    <ScatterPlotGlowOverlay
      {...defaultProps}
      locations={locations}
      aggregation="sum"
      pointRadiusUnit="Pixels"
    />,
  );
  const redrawParams = triggerRedraw();

  const arcCalls = redrawParams.ctx.arc.mock.calls;
  const r10 = arcCalls[0][2];
  const r50 = arcCalls[1][2];
  const r100 = arcCalls[2][2];

  expect(r10).toBeLessThan(r50);
  expect(r50).toBeLessThan(r100);
});

test('negative cluster label produces valid finite radius', () => {
  const locations = [
    createLocation([100, 100], {
      cluster: true,
      point_count: 3,
      sum: -5,
    }),
  ];

  render(
    <ScatterPlotGlowOverlay
      {...defaultProps}
      locations={locations}
      aggregation="sum"
    />,
  );
  const redrawParams = triggerRedraw();

  const arcCalls = redrawParams.ctx.arc.mock.calls;
  const radiusValue = arcCalls[0][2];
  expect(Number.isFinite(radiusValue)).toBe(true);
  expect(radiusValue).toBeGreaterThanOrEqual(MIN_VISIBLE_POINT_RADIUS);
});

test('ignores non-finite cluster labels when computing cluster scaling bounds', () => {
  const locations = [
    createLocation([100, 100], {
      cluster: true,
      point_count: 3,
      sum: 'invalid',
    }),
    createLocation([200, 200], {
      cluster: true,
      point_count: 3,
      sum: 100,
    }),
  ];

  render(
    <ScatterPlotGlowOverlay
      {...defaultProps}
      locations={locations}
      aggregation="sum"
      pointRadiusUnit="Pixels"
    />,
  );
  const redrawParams = triggerRedraw();

  const arcCalls = redrawParams.ctx.arc.mock.calls;

  expect(arcCalls[0][2]).toBeGreaterThanOrEqual(MAX_VISIBLE_POINT_RADIUS);
  expect(arcCalls[1][2]).toBe(defaultProps.dotRadius);
});

test('single cluster with small maxLabel gets full dotRadius', () => {
  const locations = [
    createLocation([100, 100], {
      cluster: true,
      point_count: 1,
      sum: 1,
    }),
  ];

  render(
    <ScatterPlotGlowOverlay
      {...defaultProps}
      locations={locations}
      aggregation="sum"
    />,
  );
  const redrawParams = triggerRedraw();

  const arcCalls = redrawParams.ctx.arc.mock.calls;
  // When there's only one cluster, label=maxLabel, so it gets full radius
  expect(arcCalls[0][2]).toBe(defaultProps.dotRadius);
});

test('all-negative cluster labels produce differentiated radii by magnitude', () => {
  const locations = [
    createLocation([100, 100], {
      cluster: true,
      point_count: 3,
      sum: -100,
    }),
    createLocation([200, 200], {
      cluster: true,
      point_count: 3,
      sum: -10,
    }),
    createLocation([300, 300], {
      cluster: true,
      point_count: 3,
      sum: -1,
    }),
  ];

  render(
    <ScatterPlotGlowOverlay
      {...defaultProps}
      locations={locations}
      aggregation="sum"
    />,
  );
  const redrawParams = triggerRedraw();

  const arcCalls = redrawParams.ctx.arc.mock.calls;
  const rNeg100 = arcCalls[0][2];
  const rNeg10 = arcCalls[1][2];
  const rNeg1 = arcCalls[2][2];

  // Higher magnitude = bigger circle: |-100| > |-10| > |-1|
  expect(rNeg1).toBeLessThan(rNeg10);
  expect(rNeg10).toBeLessThan(rNeg100);
  expect(Number.isFinite(rNeg100)).toBe(true);
  expect(Number.isFinite(rNeg10)).toBe(true);
  expect(Number.isFinite(rNeg1)).toBe(true);
  expect(rNeg1).toBeGreaterThanOrEqual(MIN_VISIBLE_POINT_RADIUS);
  expect(rNeg100).toBe(defaultProps.dotRadius);
});

test('mixed positive-and-negative cluster labels size by magnitude', () => {
  const locations = [
    createLocation([100, 100], {
      cluster: true,
      point_count: 3,
      sum: -50,
    }),
    createLocation([200, 200], {
      cluster: true,
      point_count: 3,
      sum: 0,
    }),
    createLocation([300, 300], {
      cluster: true,
      point_count: 3,
      sum: 100,
    }),
  ];

  render(
    <ScatterPlotGlowOverlay
      {...defaultProps}
      locations={locations}
      aggregation="sum"
    />,
  );
  const redrawParams = triggerRedraw();

  const arcCalls = redrawParams.ctx.arc.mock.calls;
  const rNeg50 = arcCalls[0][2];
  const rZero = arcCalls[1][2];
  const r100 = arcCalls[2][2];

  // Magnitude ordering: |0| < |-50| < |100|
  expect(rZero).toBeLessThan(rNeg50);
  expect(rNeg50).toBeLessThan(r100);
  expect(rZero).toBeGreaterThanOrEqual(MIN_VISIBLE_POINT_RADIUS);
  expect(r100).toBe(defaultProps.dotRadius);
});

test('all-identical negative labels get equal full radii', () => {
  const locations = [
    createLocation([100, 100], {
      cluster: true,
      point_count: 3,
      sum: -5,
    }),
    createLocation([200, 200], {
      cluster: true,
      point_count: 3,
      sum: -5,
    }),
    createLocation([300, 300], {
      cluster: true,
      point_count: 3,
      sum: -5,
    }),
  ];

  render(
    <ScatterPlotGlowOverlay
      {...defaultProps}
      locations={locations}
      aggregation="sum"
    />,
  );
  const redrawParams = triggerRedraw();

  const arcCalls = redrawParams.ctx.arc.mock.calls;
  const r1 = arcCalls[0][2];
  const r2 = arcCalls[1][2];
  const r3 = arcCalls[2][2];

  expect(r1).toBe(r2);
  expect(r2).toBe(r3);
  expect(r1).toBe(defaultProps.dotRadius);
});

test('single negative cluster gets full radius', () => {
  const locations = [
    createLocation([100, 100], {
      cluster: true,
      point_count: 3,
      sum: -5,
    }),
  ];

  render(
    <ScatterPlotGlowOverlay
      {...defaultProps}
      locations={locations}
      aggregation="sum"
    />,
  );
  const redrawParams = triggerRedraw();

  const arcCalls = redrawParams.ctx.arc.mock.calls;
  expect(arcCalls[0][2]).toBe(defaultProps.dotRadius);
});

test('large negative cluster labels are abbreviated', () => {
  const locations = [
    createLocation([100, 100], {
      cluster: true,
      point_count: 3,
      sum: -50000,
    }),
  ];

  render(
    <ScatterPlotGlowOverlay
      {...defaultProps}
      locations={locations}
      aggregation="sum"
    />,
  );
  const redrawParams = triggerRedraw();

  const fillTextCalls = redrawParams.ctx.fillText.mock.calls;
  const labelArg = fillTextCalls[0][0];
  expect(labelArg).toBe('-50k');
});

test.each([
  ['sum', [{ sum: -100 }, { sum: -10 }, { sum: -1 }]],
  ['min', [{ min: -100 }, { min: -10 }, { min: -1 }]],
  ['max', [{ max: -100 }, { max: -10 }, { max: -1 }]],
  ['mean', [{ sum: -300 }, { sum: -30 }, { sum: -3 }]],
])(
  'negative %s cluster labels preserve magnitude-based ordering',
  (aggregation, labelProps) => {
    const locations = [
      createLocation([100, 100], {
        cluster: true,
        point_count: 3,
        ...labelProps[0],
      }),
      createLocation([200, 200], {
        cluster: true,
        point_count: 3,
        ...labelProps[1],
      }),
      createLocation([300, 300], {
        cluster: true,
        point_count: 3,
        ...labelProps[2],
      }),
    ];

    render(
      <ScatterPlotGlowOverlay
        {...defaultProps}
        locations={locations}
        aggregation={aggregation}
      />,
    );
    const redrawParams = triggerRedraw();

    const arcCalls = redrawParams.ctx.arc.mock.calls;
    const largestRadius = arcCalls[0][2];
    const middleRadius = arcCalls[1][2];
    const smallestRadius = arcCalls[2][2];

    expect(smallestRadius).toBeLessThan(middleRadius);
    expect(middleRadius).toBeLessThan(largestRadius);
    expect(largestRadius).toBe(defaultProps.dotRadius);
  },
);

test('zero-value cluster is visible with minimum radius', () => {
  const locations = [
    createLocation([100, 100], {
      cluster: true,
      point_count: 5,
      sum: 0,
    }),
    createLocation([200, 200], {
      cluster: true,
      point_count: 10,
      sum: 100,
    }),
  ];

  render(
    <ScatterPlotGlowOverlay
      {...defaultProps}
      locations={locations}
      aggregation="sum"
      pointRadiusUnit="Pixels"
    />,
  );
  const redrawParams = triggerRedraw();

  const arcCalls = redrawParams.ctx.arc.mock.calls;
  const zeroClusterRadius = arcCalls[0][2];

  expect(Number.isFinite(zeroClusterRadius)).toBe(true);
  expect(zeroClusterRadius).toBeGreaterThanOrEqual(MAX_VISIBLE_POINT_RADIUS);
});
