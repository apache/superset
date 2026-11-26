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
import { COLOR_SCHEME_TYPES } from '../../utilities/utils';
import { TRANSPARENT_COLOR_ARRAY } from '../../utils';
import { GetLayerTypeParams } from '../../factory';
import { getLayer } from './H3Hexagon';
import { H3Feature } from './transformProps';

// maplibre-gl 6 is ESM-only, so jest can't resolve it; DeckGLContainer.tsx
// (pulled in via factory.tsx) calls setWorkerUrl() on it at import time.
jest.mock('maplibre-gl', () => ({ setWorkerUrl: jest.fn() }), {
  virtual: true,
});

type ColorAccessor = (datum: H3Feature) => number[];
type ElevationAccessor = (datum: H3Feature) => number;

const features: H3Feature[] = [
  { hexagon: '891f1d48177ffff', elevation: 0 },
  { hexagon: '891f1d48163ffff', elevation: 10 },
  { hexagon: '891f1d48167ffff' },
];

const buildLayer = (formData: Record<string, unknown>) =>
  getLayer({
    formData: {
      datasource: '1__table',
      viz_type: 'deck_h3_hexagon',
      slice_id: 1,
      ...formData,
    },
    payload: { data: { features } },
    setTooltip: () => {},
    setDataMask: () => {},
    onContextMenu: () => {},
    filterState: {},
    emitCrossFilters: false,
  } as GetLayerTypeParams);

test('getLayer creates an H3 hexagon layer keyed by slice id', () => {
  const layer = buildLayer({ extruded: false, coverage: 0.5 });

  expect(layer.id).toBe('h3-hexagon-layer-1');
  expect(layer.props.data).toEqual(features);
  expect(layer.props.extruded).toBe(false);
  expect(layer.props.coverage).toBe(0.5);
});

test('getLayer reads the hexagon id and defaults a missing elevation to 0', () => {
  const layer = buildLayer({});
  const getHexagon = layer.props.getHexagon as unknown as (
    d: H3Feature,
  ) => string;
  const getElevation = layer.props.getElevation as unknown as ElevationAccessor;

  expect(getHexagon(features[0])).toBe('891f1d48177ffff');
  expect(getElevation(features[1])).toBe(10);
  expect(getElevation(features[2])).toBe(0);
});

test('getLayer uses the fixed fill color when the fixed color scheme is selected', () => {
  const layer = buildLayer({
    color_scheme_type: COLOR_SCHEME_TYPES.fixed_color,
    fill_color_picker: { r: 10, g: 20, b: 30, a: 1 },
  });
  const getFillColor = layer.props.getFillColor as unknown as ColorAccessor;

  expect(getFillColor(features[1])).toEqual([10, 20, 30, 255]);
});

test('getLayer keeps a zero-valued cell visible with the linear palette', () => {
  const layer = buildLayer({
    color_scheme_type: COLOR_SCHEME_TYPES.linear_palette,
    linear_color_scheme: ['#000000', '#ffffff'],
    metric: 'count',
    opacity: 100,
  });
  const getFillColor = layer.props.getFillColor as unknown as ColorAccessor;

  expect(getFillColor(features[0])).toEqual([0, 0, 0, 255]);
  expect(getFillColor(features[1])).toEqual([255, 255, 255, 255]);
  // A cell without a metric value has nothing to scale and stays transparent.
  expect(getFillColor(features[2])).toEqual(TRANSPARENT_COLOR_ARRAY);
});

test('getLayer falls back to the fixed color for the linear palette without a metric', () => {
  const layer = buildLayer({
    color_scheme_type: COLOR_SCHEME_TYPES.linear_palette,
    fill_color_picker: { r: 1, g: 2, b: 3, a: 1 },
  });
  const getFillColor = layer.props.getFillColor as unknown as ColorAccessor;

  expect(getFillColor(features[1])).toEqual([1, 2, 3, 255]);
});

test('getLayer colors cells by matching color breakpoint', () => {
  const layer = buildLayer({
    color_scheme_type: COLOR_SCHEME_TYPES.color_breakpoints,
    color_breakpoints: [
      { minValue: 0, maxValue: 5, color: { r: 255, g: 0, b: 0, a: 1 } },
      { minValue: 6, maxValue: 20, color: { r: 0, g: 255, b: 0, a: 1 } },
    ],
    default_breakpoint_color: { r: 9, g: 9, b: 9, a: 1 },
  });
  const getFillColor = layer.props.getFillColor as unknown as ColorAccessor;

  expect(getFillColor(features[0])).toEqual([255, 0, 0, 255]);
  expect(getFillColor(features[1])).toEqual([0, 255, 0, 255]);
  expect(getFillColor(features[2])).toEqual([9, 9, 9, 255]);
});
