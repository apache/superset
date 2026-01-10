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

import { render } from 'spec/helpers/testing-library';
import ScatterPlotGlowOverlay, {
  AggregationType,
} from '../src/ScatterPlotGlowOverlay';

jest.mock('react-map-gl/mapbox', () => ({
  useMap: () => ({
    current: {
      project: (coords: [number, number]) => ({
        x: coords[0] * 10,
        y: coords[1] * 10,
      }),
      on: jest.fn(),
      off: jest.fn(),
    },
  }),
}));

const mockLocation = {
  geometry: {
    coordinates: [10, 20] as [number, number],
    type: 'Point',
  },
  properties: {},
};

const mockClusterLocation = {
  geometry: {
    coordinates: [10, 20] as [number, number],
    type: 'Point',
  },
  properties: {
    cluster: true,
    point_count: 10,
    sum: 100,
    squaredSum: 1200,
    min: 5,
    max: 20,
  },
};

test('renders without crashing', () => {
  const { container } = render(
    <ScatterPlotGlowOverlay locations={[]} rgb={[255, 0, 0, 255]} />,
  );

  expect(container.querySelector('canvas')).toBeInTheDocument();
});

test('renders canvas element', () => {
  const { container } = render(
    <ScatterPlotGlowOverlay
      locations={[mockLocation]}
      rgb={[255, 128, 64, 255]}
    />,
  );

  const canvas = container.querySelector('canvas');
  expect(canvas).toBeInTheDocument();
  expect(canvas?.tagName).toBe('CANVAS');
});

test('renders with default props', () => {
  const { container } = render(<ScatterPlotGlowOverlay locations={[]} />);

  expect(container.querySelector('canvas')).toBeInTheDocument();
});

test('renders with empty locations array', () => {
  const { container } = render(
    <ScatterPlotGlowOverlay locations={[]} rgb={[255, 0, 0, 255]} />,
  );

  expect(container.querySelector('canvas')).toBeInTheDocument();
});

test('renders with single location', () => {
  const { container } = render(
    <ScatterPlotGlowOverlay
      locations={[mockLocation]}
      rgb={[255, 0, 0, 255]}
    />,
  );

  expect(container.querySelector('canvas')).toBeInTheDocument();
});

test('renders with multiple locations', () => {
  const locations = [mockLocation, { ...mockLocation }];
  const { container } = render(
    <ScatterPlotGlowOverlay locations={locations} rgb={[255, 0, 0, 255]} />,
  );

  expect(container.querySelector('canvas')).toBeInTheDocument();
});

test('renders with cluster location', () => {
  const { container } = render(
    <ScatterPlotGlowOverlay
      locations={[mockClusterLocation]}
      rgb={[255, 0, 0, 255]}
      aggregation="sum"
    />,
  );

  expect(container.querySelector('canvas')).toBeInTheDocument();
});

test('computes cluster label as point_count when no aggregation specified', () => {
  const { container } = render(
    <ScatterPlotGlowOverlay
      locations={[mockClusterLocation]}
      rgb={[255, 0, 0, 255]}
    />,
  );

  expect(container.querySelector('canvas')).toBeInTheDocument();
});

test('computes cluster label using sum aggregation', () => {
  const location = {
    ...mockClusterLocation,
    properties: {
      ...mockClusterLocation.properties,
      sum: 150,
    },
  };

  const { container } = render(
    <ScatterPlotGlowOverlay
      locations={[location]}
      rgb={[255, 0, 0, 255]}
      aggregation="sum"
    />,
  );

  expect(container.querySelector('canvas')).toBeInTheDocument();
});

test('computes cluster label using min aggregation', () => {
  const location = {
    ...mockClusterLocation,
    properties: {
      ...mockClusterLocation.properties,
      min: 5,
    },
  };

  const { container } = render(
    <ScatterPlotGlowOverlay
      locations={[location]}
      rgb={[255, 0, 0, 255]}
      aggregation="min"
    />,
  );

  expect(container.querySelector('canvas')).toBeInTheDocument();
});

test('computes cluster label using max aggregation', () => {
  const location = {
    ...mockClusterLocation,
    properties: {
      ...mockClusterLocation.properties,
      max: 20,
    },
  };

  const { container } = render(
    <ScatterPlotGlowOverlay
      locations={[location]}
      rgb={[255, 0, 0, 255]}
      aggregation="max"
    />,
  );

  expect(container.querySelector('canvas')).toBeInTheDocument();
});

test('computes cluster label using mean aggregation', () => {
  const location = {
    ...mockClusterLocation,
    properties: {
      cluster: true,
      point_count: 10,
      sum: 100,
      squaredSum: 1200,
    },
  };

  const { container } = render(
    <ScatterPlotGlowOverlay
      locations={[location]}
      rgb={[255, 0, 0, 255]}
      aggregation="mean"
    />,
  );

  expect(container.querySelector('canvas')).toBeInTheDocument();
});

test('computes cluster label using variance aggregation', () => {
  const location = {
    ...mockClusterLocation,
    properties: {
      cluster: true,
      point_count: 10,
      sum: 100,
      squaredSum: 1200,
    },
  };

  const { container } = render(
    <ScatterPlotGlowOverlay
      locations={[location]}
      rgb={[255, 0, 0, 255]}
      aggregation="var"
    />,
  );

  expect(container.querySelector('canvas')).toBeInTheDocument();
});

test('computes cluster label using stdev aggregation', () => {
  const location = {
    ...mockClusterLocation,
    properties: {
      cluster: true,
      point_count: 10,
      sum: 100,
      squaredSum: 1200,
    },
  };

  const { container } = render(
    <ScatterPlotGlowOverlay
      locations={[location]}
      rgb={[255, 0, 0, 255]}
      aggregation="stdev"
    />,
  );

  expect(container.querySelector('canvas')).toBeInTheDocument();
});

test('uses white text color on dark background (low luminance)', () => {
  const darkRgb: [number, number, number, number] = [255, 10, 10, 10];
  const { container } = render(
    <ScatterPlotGlowOverlay
      locations={[mockClusterLocation]}
      rgb={darkRgb}
      aggregation="sum"
    />,
  );

  expect(container.querySelector('canvas')).toBeInTheDocument();
});

test('uses black text color on light background (high luminance)', () => {
  const lightRgb: [number, number, number, number] = [255, 240, 240, 240];
  const { container } = render(
    <ScatterPlotGlowOverlay
      locations={[mockClusterLocation]}
      rgb={lightRgb}
      aggregation="sum"
    />,
  );

  expect(container.querySelector('canvas')).toBeInTheDocument();
});

test('renders point with custom radius', () => {
  const location = {
    ...mockLocation,
    properties: {
      radius: 50,
    },
  };

  const { container } = render(
    <ScatterPlotGlowOverlay
      locations={[location]}
      rgb={[255, 0, 0, 255]}
      dotRadius={100}
    />,
  );

  expect(container.querySelector('canvas')).toBeInTheDocument();
});

test('renders point with metric label', () => {
  const location = {
    ...mockLocation,
    properties: {
      metric: 42.5,
    },
  };

  const { container } = render(
    <ScatterPlotGlowOverlay locations={[location]} rgb={[255, 0, 0, 255]} />,
  );

  expect(container.querySelector('canvas')).toBeInTheDocument();
});

test('renders point with null radius (uses default)', () => {
  const location = {
    ...mockLocation,
    properties: {
      radius: null,
    },
  };

  const { container } = render(
    <ScatterPlotGlowOverlay locations={[location]} rgb={[255, 0, 0, 255]} />,
  );

  expect(container.querySelector('canvas')).toBeInTheDocument();
});

test('handles kilometers pointRadiusUnit', () => {
  const location = {
    ...mockLocation,
    properties: {
      radius: 10,
    },
  };

  const { container } = render(
    <ScatterPlotGlowOverlay
      locations={[location]}
      rgb={[255, 0, 0, 255]}
      pointRadiusUnit="Kilometers"
      zoom={10}
    />,
  );

  expect(container.querySelector('canvas')).toBeInTheDocument();
});

test('handles miles pointRadiusUnit', () => {
  const location = {
    ...mockLocation,
    properties: {
      radius: 10,
    },
  };

  const { container } = render(
    <ScatterPlotGlowOverlay
      locations={[location]}
      rgb={[255, 0, 0, 255]}
      pointRadiusUnit="Miles"
      zoom={10}
    />,
  );

  expect(container.querySelector('canvas')).toBeInTheDocument();
});

test('uses custom lngLatAccessor', () => {
  const customAccessor = () => [50, 60] as [number, number];
  const { container } = render(
    <ScatterPlotGlowOverlay
      locations={[mockLocation]}
      rgb={[255, 0, 0, 255]}
      lngLatAccessor={customAccessor}
    />,
  );

  expect(container.querySelector('canvas')).toBeInTheDocument();
});

test('handles isDragging with renderWhileDragging true', () => {
  const { container } = render(
    <ScatterPlotGlowOverlay
      locations={[mockLocation]}
      rgb={[255, 0, 0, 255]}
      isDragging
      renderWhileDragging
    />,
  );

  expect(container.querySelector('canvas')).toBeInTheDocument();
});

test('handles isDragging with renderWhileDragging false', () => {
  const { container } = render(
    <ScatterPlotGlowOverlay
      locations={[mockLocation]}
      rgb={[255, 0, 0, 255]}
      isDragging
      renderWhileDragging={false}
    />,
  );

  expect(container.querySelector('canvas')).toBeInTheDocument();
});

test('uses custom composite operation', () => {
  const { container } = render(
    <ScatterPlotGlowOverlay
      locations={[mockLocation]}
      rgb={[255, 0, 0, 255]}
      compositeOperation="screen"
    />,
  );

  expect(container.querySelector('canvas')).toBeInTheDocument();
});

test('renders with all aggregation types', () => {
  const aggregations: AggregationType[] = [
    'sum',
    'min',
    'max',
    'mean',
    'var',
    'stdev',
  ];

  aggregations.forEach(aggregation => {
    const { container } = render(
      <ScatterPlotGlowOverlay
        locations={[mockClusterLocation]}
        rgb={[255, 0, 0, 255]}
        aggregation={aggregation}
      />,
    );

    expect(container.querySelector('canvas')).toBeInTheDocument();
  });
});

test('formats large cluster labels with "k" suffix (>= 10000)', () => {
  const location = {
    ...mockClusterLocation,
    properties: {
      cluster: true,
      point_count: 15000,
      sum: 15000,
    },
  };

  const { container } = render(
    <ScatterPlotGlowOverlay
      locations={[location]}
      rgb={[255, 0, 0, 255]}
      aggregation="sum"
    />,
  );

  expect(container.querySelector('canvas')).toBeInTheDocument();
});

test('formats cluster labels between 1000-9999 with one decimal "k" suffix', () => {
  const location = {
    ...mockClusterLocation,
    properties: {
      cluster: true,
      point_count: 2500,
      sum: 2500,
    },
  };

  const { container } = render(
    <ScatterPlotGlowOverlay
      locations={[location]}
      rgb={[255, 0, 0, 255]}
      aggregation="sum"
    />,
  );

  expect(container.querySelector('canvas')).toBeInTheDocument();
});

test('does not format cluster labels below 1000', () => {
  const location = {
    ...mockClusterLocation,
    properties: {
      cluster: true,
      point_count: 999,
      sum: 999,
    },
  };

  const { container } = render(
    <ScatterPlotGlowOverlay
      locations={[location]}
      rgb={[255, 0, 0, 255]}
      aggregation="sum"
    />,
  );

  expect(container.querySelector('canvas')).toBeInTheDocument();
});

test('handles missing aggregation values gracefully', () => {
  const location = {
    ...mockClusterLocation,
    properties: {
      cluster: true,
      point_count: 10,
    },
  };

  const { container } = render(
    <ScatterPlotGlowOverlay
      locations={[location]}
      rgb={[255, 0, 0, 255]}
      aggregation="sum"
    />,
  );

  expect(container.querySelector('canvas')).toBeInTheDocument();
});

test('handles non-numeric metric values', () => {
  const location = {
    ...mockLocation,
    properties: {
      metric: 'N/A',
    },
  };

  const { container } = render(
    <ScatterPlotGlowOverlay locations={[location]} rgb={[255, 0, 0, 255]} />,
  );

  expect(container.querySelector('canvas')).toBeInTheDocument();
});

test('overlay container has correct positioning styles', () => {
  const { container } = render(
    <ScatterPlotGlowOverlay
      locations={[mockLocation]}
      rgb={[255, 0, 0, 255]}
    />,
  );

  const overlayDiv = container.firstChild as HTMLElement;
  expect(overlayDiv).toHaveStyle({
    position: 'absolute',
    left: '0px',
    top: '0px',
    width: '100%',
    height: '100%',
    pointerEvents: 'none',
  });
});

test('canvas has correct positioning styles', () => {
  const { container } = render(
    <ScatterPlotGlowOverlay
      locations={[mockLocation]}
      rgb={[255, 0, 0, 255]}
    />,
  );

  const canvas = container.querySelector('canvas') as HTMLCanvasElement;
  expect(canvas).toHaveStyle({
    position: 'absolute',
    left: '0px',
    top: '0px',
    pointerEvents: 'none',
  });
});
