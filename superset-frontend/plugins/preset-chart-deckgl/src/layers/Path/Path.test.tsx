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
// eslint-disable-next-line import/no-extraneous-dependencies
import '@testing-library/jest-dom';
import { getLayer, getPoints, getHighlightLayer } from './Path';

jest.mock('../../DeckGLContainer', () => ({
  DeckGLContainerStyledWrapper: ({ children }: any) => (
    <div data-testid="deckgl-container">{children}</div>
  ),
}));

jest.mock('../../factory', () => ({
  createCategoricalDeckGLComponent: jest.fn(() => () => null),
  GetLayerType: {},
}));

const mockFormData = {
  datasource: 'test_datasource',
  viz_type: 'deck_path',
  color_picker: { r: 0, g: 122, b: 135, a: 1 },
  line_width: 150,
  line_width_unit: 'meters',
  slice_id: 1,
};

const mockPayload = {
  data: {
    features: [
      {
        path: [
          [-122.4, 37.8],
          [-122.5, 37.9],
        ],
      },
    ],
  },
};

const mockLayerParams = {
  onContextMenu: jest.fn(),
  filterState: undefined,
  setDataMask: jest.fn(),
  setTooltip: jest.fn(),
  emitCrossFilters: false,
};

test('getLayer uses line_width_unit from formData', () => {
  const layer = getLayer({
    formData: mockFormData,
    payload: mockPayload,
    onContextMenu: jest.fn(),
    filterState: undefined,
    setDataMask: jest.fn(),
    setTooltip: jest.fn(),
    emitCrossFilters: false,
  });

  expect(layer.props.widthUnits).toBe('meters');
});

test('getLayer uses pixels when line_width_unit is pixels', () => {
  const layer = getLayer({
    formData: { ...mockFormData, line_width_unit: 'pixels' },
    payload: mockPayload,
    onContextMenu: jest.fn(),
    filterState: undefined,
    setDataMask: jest.fn(),
    setTooltip: jest.fn(),
    emitCrossFilters: false,
  });

  expect(layer.props.widthUnits).toBe('pixels');
});

test('getHighlightLayer uses line_width_unit from formData', () => {
  const layer = getHighlightLayer({
    formData: mockFormData,
    payload: mockPayload,
    filterState: { value: [] },
    onContextMenu: jest.fn(),
    setDataMask: jest.fn(),
    setTooltip: jest.fn(),
    emitCrossFilters: false,
  });

  expect(layer.props.widthUnits).toBe('meters');
});

test('getPoints extracts points from path data', () => {
  const data = [
    {
      path: [
        [0, 0],
        [1, 1],
      ],
    },
    {
      path: [
        [2, 2],
        [3, 3],
      ],
    },
  ];

  const points = getPoints(data);

  expect(points).toHaveLength(4);
  expect(points[0]).toEqual([0, 0]);
  expect(points[2]).toEqual([2, 2]);
});

test('Fixed width mode returns constant width for all paths', () => {
  const payload = {
    data: {
      features: [
        {
          path: [
            [0, 0],
            [1, 1],
          ],
          width: 5,
        },
        {
          path: [
            [2, 2],
            [3, 3],
          ],
          width: 5,
        },
        {
          path: [
            [4, 4],
            [5, 5],
          ],
          width: 5,
        },
      ],
    },
  };

  const layer = getLayer({
    formData: {
      ...mockFormData,
      min_width: 1,
      max_width: 20,
      line_width_multiplier: 1,
    },
    payload,
    ...mockLayerParams,
  });

  const data = layer.props.data as any[];
  const widths = data.map(d => d.width);

  widths.forEach(width => {
    expect(width).toBe(widths[0]);
  });
});

test('Fixed width mode applies multiplier correctly', () => {
  const payload = {
    data: {
      features: [
        {
          path: [
            [0, 0],
            [1, 1],
          ],
          width: 5,
        },
      ],
    },
  };

  const layer = getLayer({
    formData: {
      ...mockFormData,
      line_width_multiplier: 3,
      min_width: 1,
      max_width: 100,
    },
    payload,
    ...mockLayerParams,
  });

  const data = layer.props.data as any[];
  expect(data[0].width).toBe(15);
});

test('Fixed width mode enforces minimum width bound', () => {
  const payload = {
    data: {
      features: [
        {
          path: [
            [0, 0],
            [1, 1],
          ],
          width: 0.1,
        },
      ],
    },
  };

  const layer = getLayer({
    formData: {
      ...mockFormData,
      min_width: 2,
      max_width: 20,
      line_width_multiplier: 1,
    },
    payload,
    ...mockLayerParams,
  });

  const data = layer.props.data as any[];
  expect(data[0].width).toBeGreaterThanOrEqual(2);
});

test('Fixed width mode enforces maximum width bound', () => {
  const payload = {
    data: {
      features: [
        {
          path: [
            [0, 0],
            [1, 1],
          ],
          width: 100,
        },
      ],
    },
  };

  const layer = getLayer({
    formData: {
      ...mockFormData,
      min_width: 1,
      max_width: 20,
      line_width_multiplier: 1,
    },
    payload,
    ...mockLayerParams,
  });

  const data = layer.props.data as any[];
  expect(data[0].width).toBeLessThanOrEqual(20);
});

test('Fixed width mode defaults width to 1 when no width is provided', () => {
  const payload = {
    data: {
      features: [
        {
          path: [
            [0, 0],
            [1, 1],
          ],
        },
      ],
    },
  };

  const layer = getLayer({
    formData: {
      ...mockFormData,
      line_width: undefined,
      min_width: 1,
      max_width: 20,
      line_width_multiplier: 1,
    },
    payload,
    ...mockLayerParams,
  });

  const data = layer.props.data as any[];
  expect(data[0].width).toBe(1);
});

test('Metric mode normalizes widths proportionally between min and max bounds', () => {
  const payload = {
    data: {
      features: [
        {
          path: [
            [0, 0],
            [1, 1],
          ],
          width: 100,
        },
        {
          path: [
            [2, 2],
            [3, 3],
          ],
          width: 200,
        },
        {
          path: [
            [4, 4],
            [5, 5],
          ],
          width: 300,
        },
      ],
    },
  };

  const layer = getLayer({
    formData: {
      ...mockFormData,
      line_width: { type: 'metric', value: 'some_metric' },
      min_width: 1,
      max_width: 20,
      line_width_multiplier: 1,
    },
    payload,
    ...mockLayerParams,
  });

  const data = layer.props.data as any[];
  const widths = data.map((d: any) => d.width);

  expect(widths[0]).toBeCloseTo(1);
  expect(widths[1]).toBeCloseTo(10.5);
  expect(widths[2]).toBeCloseTo(20);
});

test('Metric mode applies multiplier after normalization', () => {
  const payload = {
    data: {
      features: [
        {
          path: [
            [0, 0],
            [1, 1],
          ],
          width: 100,
        },
        {
          path: [
            [2, 2],
            [3, 3],
          ],
          width: 200,
        },
      ],
    },
  };

  const layer = getLayer({
    formData: {
      ...mockFormData,
      line_width: { type: 'metric', value: 'some_metric' },
      min_width: 1,
      max_width: 20,
      line_width_multiplier: 2,
    },
    payload,
    ...mockLayerParams,
  });

  const data = layer.props.data as any[];

  expect(data[0].width).toBeCloseTo(2);
  expect(data[1].width).toBe(20);
});

test('Metric mode enforces bounds after multiplier', () => {
  const payload = {
    data: {
      features: [
        {
          path: [
            [0, 0],
            [1, 1],
          ],
          width: 100,
        },
        {
          path: [
            [2, 2],
            [3, 3],
          ],
          width: 500,
        },
      ],
    },
  };

  const layer = getLayer({
    formData: {
      ...mockFormData,
      min_width: 5,
      max_width: 15,
      line_width_multiplier: 10,
    },
    payload,
    ...mockLayerParams,
  });

  const data = layer.props.data as any[];

  data.forEach((d: any) => {
    expect(d.width).toBeGreaterThanOrEqual(5);
    expect(d.width).toBeLessThanOrEqual(15);
  });
});

test('Metric mode handles equal width values.', () => {
  const payload = {
    data: {
      features: [
        {
          path: [
            [0, 0],
            [1, 1],
          ],
          width: 100,
        },
        {
          path: [
            [2, 2],
            [3, 3],
          ],
          width: 100,
        },
      ],
    },
  };

  const layer = getLayer({
    formData: {
      ...mockFormData,
      min_width: 1,
      max_width: 20,
      line_width_multiplier: 1,
    },
    payload,
    ...mockLayerParams,
  });

  const data = layer.props.data as any[];

  expect(data[0].width).toBe(data[1].width);
});

test('Metric mode handles null width values', () => {
  const payload = {
    data: {
      features: [
        {
          path: [
            [0, 0],
            [1, 1],
          ],
          width: 100,
        },
        {
          path: [
            [2, 2],
            [3, 3],
          ],
          width: null,
        },
        {
          path: [
            [4, 4],
            [5, 5],
          ],
          width: 300,
        },
      ],
    },
  };

  const layer = getLayer({
    formData: {
      ...mockFormData,
      line_width: { type: 'metric', value: 'some_metric' },
      min_width: 1,
      max_width: 20,
      line_width_multiplier: 1,
    },
    payload,
    ...mockLayerParams,
  });

  const data = layer.props.data as any[];

  expect(data[1].width).toBe(1);
  expect(data[0].width).toBeCloseTo(1);
  expect(data[2].width).toBeCloseTo(20);
});

test('Fixed color mode returns same color for all paths', () => {
  const payload = {
    data: {
      features: [
        {
          path: [
            [0, 0],
            [1, 1],
          ],
        },
        {
          path: [
            [2, 2],
            [3, 3],
          ],
        },
        {
          path: [
            [4, 4],
            [5, 5],
          ],
        },
      ],
    },
  };

  const layer = getLayer({
    formData: {
      ...mockFormData,
      color_picker: { r: 255, g: 100, b: 50, a: 1 },
    },
    payload,
    ...mockLayerParams,
  });

  const data = layer.props.data as any[];
  const expectedColor = [255, 100, 50, 255];

  data.forEach((d: any) => {
    expect(d.color).toEqual(expectedColor);
  });
});

test('Categorical mode preserves distinct colors for selected categories', () => {
  const payload = {
    data: {
      features: [
        {
          path: [
            [0, 0],
            [1, 1],
          ],
          color: [255, 0, 0, 255],
          cat_color: 'A',
        },
        {
          path: [
            [2, 2],
            [3, 3],
          ],
          color: [0, 0, 255, 255],
          cat_color: 'B',
        },
        {
          path: [
            [4, 4],
            [5, 5],
          ],
          color: [255, 0, 0, 255],
          cat_color: 'A',
        },
      ],
    },
  };

  const layer = getLayer({
    formData: mockFormData,
    payload,
    ...mockLayerParams,
  });

  const data = layer.props.data as any[];

  expect(data[0].color).toEqual(data[2].color);
  expect(data[0].color).not.toEqual(data[1].color);
});

test('Breakpoint mode preserves colors assigned by addColor based on metric ranges', () => {
  const payload = {
    data: {
      features: [
        {
          path: [
            [0, 0],
            [1, 1],
          ],
          color: [255, 0, 0, 255],
          metric: 50,
        },
        {
          path: [
            [2, 2],
            [3, 3],
          ],
          color: [0, 0, 255, 255],
          metric: 200,
        },
        {
          path: [
            [4, 4],
            [5, 5],
          ],
          color: [255, 0, 0, 255],
          metric: 75,
        },
      ],
    },
  };

  const layer = getLayer({
    formData: mockFormData,
    payload,
    ...mockLayerParams,
  });

  const data = layer.props.data as any[];

  expect(data[0].color).toEqual(data[2].color);
  expect(data[0].color).not.toEqual(data[1].color);
});
