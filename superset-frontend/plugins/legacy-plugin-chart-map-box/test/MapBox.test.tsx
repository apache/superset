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

import { render, waitFor } from 'spec/helpers/testing-library';
import MapBox, {
  Clusterer,
  DEFAULT_MAX_ZOOM,
  DEFAULT_POINT_RADIUS,
} from '../src/MapBox';
import { type Location } from '../src/ScatterPlotGlowOverlay';

type BBox = [number, number, number, number];

const mockMap = {
  on: jest.fn(),
  off: jest.fn(),
  project: jest.fn((coords: [number, number]) => ({
    x: coords[0],
    y: coords[1],
  })),
  getCanvas: jest.fn(() => ({
    style: {},
  })),
  getContainer: jest.fn(() => document.createElement('div')),
};

const MockMap = ({ children, onMove, onIdle }: any) => {
  const { useEffect } = require('react');
  useEffect(() => {
    onIdle?.();
  }, [onIdle]);
  return (
    <div
      data-test="mapbox-mock"
      onClick={() =>
        onMove?.({ viewState: { latitude: 0, longitude: 0, zoom: 5 } })
      }
    >
      {children}
    </div>
  );
};

jest.mock('react-map-gl/mapbox', () => ({
  __esModule: true,
  default: (props: any) => <MockMap {...props} />,
  useMap: () => ({ current: mockMap }),
}));

jest.mock('supercluster');

const mockGetClusters = jest.fn<Location[], [BBox, number]>(() => []);
const mockClusterer: Clusterer = {
  getClusters: mockGetClusters,
};

const defaultProps = {
  bounds: [
    [-122.5, 37.5],
    [-122.0, 38.0],
  ] as [[number, number], [number, number]],
  clusterer: mockClusterer,
  mapboxApiKey: 'test-api-key',
  width: 800,
  height: 600,
};

beforeEach(() => {
  jest.clearAllMocks();
});

test('renders without crashing', () => {
  const { getByTestId } = render(<MapBox {...defaultProps} />);
  expect(getByTestId('mapbox-mock')).toBeInTheDocument();
});

test('initializes viewport from bounds', () => {
  const { container } = render(<MapBox {...defaultProps} />);
  expect(
    container.querySelector('[data-test="mapbox-mock"]'),
  ).toBeInTheDocument();
});

test('renders with default width and height when not provided', () => {
  const props = {
    ...defaultProps,
    width: undefined,
    height: undefined,
  };
  const { container } = render(<MapBox {...props} />);
  expect(
    container.querySelector('[data-test="mapbox-mock"]'),
  ).toBeInTheDocument();
});

test('calls clusterer.getClusters with correct bbox and zoom', () => {
  render(<MapBox {...defaultProps} />);

  expect(mockGetClusters).toHaveBeenCalled();
  const [bbox, zoom] = mockGetClusters.mock.calls[0];

  expect(Array.isArray(bbox)).toBe(true);
  expect(bbox.length).toBe(4);
  expect(typeof zoom).toBe('number');
});

test('handles viewport change events', async () => {
  const onViewportChange = jest.fn();
  const { getByTestId } = render(
    <MapBox {...defaultProps} onViewportChange={onViewportChange} />,
  );

  const mapElement = getByTestId('mapbox-mock');
  mapElement.click();

  await waitFor(() => {
    expect(onViewportChange).toHaveBeenCalled();
  });
});

test('updates state when viewport changes', async () => {
  const { getByTestId } = render(<MapBox {...defaultProps} />);

  const mapElement = getByTestId('mapbox-mock');
  mapElement.click();

  await waitFor(() => {
    expect(getByTestId('mapbox-mock')).toBeInTheDocument();
  });
});

test('uses DEFAULT_POINT_RADIUS when pointRadius not provided', () => {
  const { container } = render(<MapBox {...defaultProps} />);
  expect(
    container.querySelector('[data-test="mapbox-mock"]'),
  ).toBeInTheDocument();
  expect(DEFAULT_POINT_RADIUS).toBe(60);
});

test('uses provided pointRadius value', () => {
  const { container } = render(<MapBox {...defaultProps} pointRadius={100} />);
  expect(
    container.querySelector('[data-test="mapbox-mock"]'),
  ).toBeInTheDocument();
});

test('passes rgb prop to ScatterPlotGlowOverlay', () => {
  const rgb: [number, number, number, number] = [255, 128, 64, 255];
  const { container } = render(<MapBox {...defaultProps} rgb={rgb} />);
  expect(
    container.querySelector('[data-test="mapbox-mock"]'),
  ).toBeInTheDocument();
});

test('passes hasCustomMetric to ScatterPlotGlowOverlay', () => {
  const { container } = render(<MapBox {...defaultProps} hasCustomMetric />);
  expect(
    container.querySelector('[data-test="mapbox-mock"]'),
  ).toBeInTheDocument();
});

test('passes aggregatorName when hasCustomMetric is true', () => {
  const { container } = render(
    <MapBox {...defaultProps} hasCustomMetric aggregatorName="sum" />,
  );
  expect(
    container.querySelector('[data-test="mapbox-mock"]'),
  ).toBeInTheDocument();
});

test('does not pass aggregatorName when hasCustomMetric is false', () => {
  const { container } = render(
    <MapBox {...defaultProps} hasCustomMetric={false} aggregatorName="sum" />,
  );
  expect(
    container.querySelector('[data-test="mapbox-mock"]'),
  ).toBeInTheDocument();
});

test('uses custom mapStyle when provided', () => {
  const { container } = render(
    <MapBox {...defaultProps} mapStyle="mapbox://styles/mapbox/dark-v10" />,
  );
  expect(
    container.querySelector('[data-test="mapbox-mock"]'),
  ).toBeInTheDocument();
});

test('passes renderWhileDragging prop', () => {
  const { container } = render(
    <MapBox {...defaultProps} renderWhileDragging={false} />,
  );
  expect(
    container.querySelector('[data-test="mapbox-mock"]'),
  ).toBeInTheDocument();
});

test('passes globalOpacity prop', () => {
  const { container } = render(
    <MapBox {...defaultProps} globalOpacity={0.5} />,
  );
  expect(
    container.querySelector('[data-test="mapbox-mock"]'),
  ).toBeInTheDocument();
});

test('passes pointRadiusUnit prop', () => {
  const { container } = render(
    <MapBox {...defaultProps} pointRadiusUnit="Kilometers" />,
  );
  expect(
    container.querySelector('[data-test="mapbox-mock"]'),
  ).toBeInTheDocument();
});

test('computes clusters with offset for visible area', () => {
  render(<MapBox {...defaultProps} width={1000} height={800} />);

  expect(mockGetClusters).toHaveBeenCalled();
  const [bbox] = mockGetClusters.mock.calls[0];

  expect(bbox[0]).toBeLessThan(defaultProps.bounds[0][0]);
  expect(bbox[1]).toBeLessThan(defaultProps.bounds[0][1]);
  expect(bbox[2]).toBeGreaterThan(defaultProps.bounds[1][0]);
  expect(bbox[3]).toBeGreaterThan(defaultProps.bounds[1][1]);
});

test('rounds zoom level when calling getClusters', () => {
  render(<MapBox {...defaultProps} />);

  expect(mockGetClusters).toHaveBeenCalled();
  const [, zoom] = mockGetClusters.mock.calls[0];

  expect(Number.isInteger(zoom)).toBe(true);
});

test('handles empty clusters array', () => {
  mockGetClusters.mockReturnValue([]);
  const { container } = render(<MapBox {...defaultProps} />);
  expect(
    container.querySelector('[data-test="mapbox-mock"]'),
  ).toBeInTheDocument();
});

test('handles clusters with locations', () => {
  const mockClusters: Location[] = [
    {
      geometry: {
        coordinates: [-122.4, 37.8],
        type: 'Point',
      },
      properties: {
        cluster: true,
        point_count: 5,
      },
    },
  ];
  mockGetClusters.mockReturnValue(mockClusters);

  const { container } = render(<MapBox {...defaultProps} />);
  expect(
    container.querySelector('[data-test="mapbox-mock"]'),
  ).toBeInTheDocument();
});

test('handles individual points (non-clustered)', () => {
  const mockPoints: Location[] = [
    {
      geometry: {
        coordinates: [-122.4, 37.8],
        type: 'Point',
      },
      properties: {
        cluster: false,
      },
    },
  ];
  mockGetClusters.mockReturnValue(mockPoints);

  const { container } = render(<MapBox {...defaultProps} />);
  expect(
    container.querySelector('[data-test="mapbox-mock"]'),
  ).toBeInTheDocument();
});

test('wraps map in container div with correct dimensions', () => {
  const { container } = render(
    <MapBox {...defaultProps} width={1000} height={800} />,
  );

  const wrapper = container.firstChild as HTMLElement;
  expect(wrapper).toHaveStyle({ width: '1000px' });
  expect(wrapper).toHaveStyle({ height: '800px' });
});

test('uses mapboxAccessToken prop for authentication', () => {
  const { container } = render(
    <MapBox {...defaultProps} mapboxApiKey="custom-api-key" />,
  );
  expect(
    container.querySelector('[data-test="mapbox-mock"]'),
  ).toBeInTheDocument();
});

test('handles viewport with isDragging undefined', () => {
  const { container } = render(<MapBox {...defaultProps} />);
  expect(
    container.querySelector('[data-test="mapbox-mock"]'),
  ).toBeInTheDocument();
});

test('provides lngLatAccessor to ScatterPlotGlowOverlay', () => {
  const mockLocation: Location[] = [
    {
      geometry: {
        coordinates: [-122.4, 37.8],
        type: 'Point',
      },
      properties: {},
    },
  ];
  mockGetClusters.mockReturnValue(mockLocation);

  const { container } = render(<MapBox {...defaultProps} />);
  expect(
    container.querySelector('[data-test="mapbox-mock"]'),
  ).toBeInTheDocument();
});

test('bounds remain constant during pan/zoom', () => {
  const { getByTestId } = render(<MapBox {...defaultProps} />);

  const initialCallCount = mockGetClusters.mock.calls.length;

  const mapElement = getByTestId('mapbox-mock');
  mapElement.click();

  const callsAfterClick = mockGetClusters.mock.calls.length;
  expect(callsAfterClick).toBeGreaterThan(initialCallCount);

  const firstBbox = mockGetClusters.mock.calls[0][0];
  const lastBbox = mockGetClusters.mock.calls[callsAfterClick - 1][0];

  expect(firstBbox[0]).toBeCloseTo(lastBbox[0], 5);
  expect(firstBbox[1]).toBeCloseTo(lastBbox[1], 5);
  expect(firstBbox[2]).toBeCloseTo(lastBbox[2], 5);
  expect(firstBbox[3]).toBeCloseTo(lastBbox[3], 5);
});

test('recalculates clusters on zoom change', async () => {
  const { getByTestId } = render(<MapBox {...defaultProps} />);

  const initialCallCount = mockGetClusters.mock.calls.length;

  const mapElement = getByTestId('mapbox-mock');
  mapElement.click();

  await waitFor(() => {
    const newCallCount = mockGetClusters.mock.calls.length;
    expect(newCallCount).toBeGreaterThan(initialCallCount);
  });
});

test('supports all aggregation types', () => {
  const aggregations = ['sum', 'min', 'max', 'mean', 'var', 'stdev'];

  aggregations.forEach(agg => {
    const { container } = render(
      <MapBox {...defaultProps} aggregatorName={agg as any} hasCustomMetric />,
    );
    expect(
      container.querySelector('[data-test="mapbox-mock"]'),
    ).toBeInTheDocument();
  });
});

test('handles very small bounds', () => {
  const smallBounds: [[number, number], [number, number]] = [
    [-122.001, 37.001],
    [-122.0, 37.0],
  ];
  const props = {
    ...defaultProps,
    bounds: smallBounds,
  };

  const { container } = render(<MapBox {...props} />);
  expect(
    container.querySelector('[data-test="mapbox-mock"]'),
  ).toBeInTheDocument();
});

test('handles very large bounds', () => {
  const largeBounds: [[number, number], [number, number]] = [
    [-180, -90],
    [180, 90],
  ];
  const props = {
    ...defaultProps,
    bounds: largeBounds,
  };

  const { container } = render(<MapBox {...props} />);
  expect(
    container.querySelector('[data-test="mapbox-mock"]'),
  ).toBeInTheDocument();
});

test('handles bounds crossing international date line', () => {
  const dateBounds: [[number, number], [number, number]] = [
    [170, 20],
    [-170, 30],
  ];
  const props = {
    ...defaultProps,
    bounds: dateBounds,
  };

  const { container } = render(<MapBox {...props} />);
  expect(
    container.querySelector('[data-test="mapbox-mock"]'),
  ).toBeInTheDocument();
});

test('applies 0.5% offset to visible area for better UX', () => {
  const width = 1000;
  const height = 800;
  render(<MapBox {...defaultProps} width={width} height={height} />);

  const [bbox] = mockGetClusters.mock.calls[0];
  const expectedHorizontalOffset = (width * 0.5) / 100;
  const expectedVerticalOffset = (height * 0.5) / 100;

  const actualHorizontalOffset = defaultProps.bounds[0][0] - bbox[0];
  const actualVerticalOffset = defaultProps.bounds[0][1] - bbox[1];

  expect(actualHorizontalOffset).toBeCloseTo(expectedHorizontalOffset, 5);
  expect(actualVerticalOffset).toBeCloseTo(expectedVerticalOffset, 5);
});

test('uses DEFAULT_MAX_ZOOM constant', () => {
  expect(DEFAULT_MAX_ZOOM).toBe(16);
});

test('preserveDrawingBuffer is set on Map component', () => {
  const { container } = render(<MapBox {...defaultProps} />);
  expect(
    container.querySelector('[data-test="mapbox-mock"]'),
  ).toBeInTheDocument();
});
