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

jest.mock('../../DeckGLContainer', () => ({
  DeckGLContainerStyledWrapper: ({ children }: any) => (
    <div data-testid="deckgl-container">{children}</div>
  ),
}));

jest.mock('../../factory', () => ({
  createDeckGLComponent: jest.fn(() => () => null),
  GetLayerType: {},
}));

import { getLayer, getPoints, getHighlightLayer } from './Path';

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
