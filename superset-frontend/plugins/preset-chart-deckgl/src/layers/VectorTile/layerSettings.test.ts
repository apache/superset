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

import { PRIMARY_COLOR } from '../../utilities/controls';
import { DEFAULT_DECKGL_COLOR } from '../../utilities/Shared_DeckGL';
import { ColorBreakpointType, ColorType } from '../../types';
import { COLOR_SCHEME_TYPES } from '../../utilities/utils';
import {
  DEFAULT_MAX_ZOOM,
  DEFAULT_MIN_ZOOM,
  getLayerSettings,
  isTileUrlTemplate,
  VectorTileFormData,
} from './layerSettings';

const TILE_URL = 'http://localhost:3000/places/{z}/{x}/{y}';

/** Runs getLayerSettings on minimal form data plus the given fields. */
const settingsFor = (overrides: Partial<VectorTileFormData> = {}) =>
  getLayerSettings({
    datasource: '1__table',
    viz_type: 'deck_vector_tile',
    ...overrides,
  } as VectorTileFormData);

const asRGBA = ({ r, g, b, a }: ColorType) => [r, g, b, Math.round(a * 255)];

// Defaults

test('fills in defaults for empty form data', () => {
  expect(settingsFor()).toEqual({
    tileUrl: null,
    minZoom: DEFAULT_MIN_ZOOM,
    maxZoom: DEFAULT_MAX_ZOOM,
    fillColor: asRGBA(PRIMARY_COLOR),
    colorSchemeType: COLOR_SCHEME_TYPES.fixed_color,
    colorBreakpoints: [],
    defaultBreakpointColor: asRGBA(DEFAULT_DECKGL_COLOR),
  });
});

// Tile URL

test('trims spaces around the tile URL', () => {
  expect(settingsFor({ tile_url: `  ${TILE_URL}  ` }).tileUrl).toBe(TILE_URL);
});

test.each([
  ['missing {z}', 'http://localhost:3000/places/{x}/{y}'],
  ['missing {x}', 'http://localhost:3000/places/{z}/{y}'],
  ['missing {y}', 'http://localhost:3000/places/{z}/{x}'],
  ['empty', ''],
  ['only spaces', '   '],
])('rejects a tile URL that is %s', (_, tileUrl) => {
  expect(settingsFor({ tile_url: tileUrl }).tileUrl).toBeNull();
});

test('accepts placeholders in any order', () => {
  const url = 'http://tiles/{y}/{x}/{z}.pbf';
  expect(settingsFor({ tile_url: url }).tileUrl).toBe(url);
});

test.each([undefined, null, 42, {}])(
  'isTileUrlTemplate rejects the non-string %p',
  value => {
    expect(isTileUrlTemplate(value)).toBe(false);
  },
);

// Zoom

test.each([
  ['a number', 10, 10],
  ['a numeric string', '10', 10],
  ['a decimal number (rounded)', 10.6, 11],
  ['text', 'abc', DEFAULT_MAX_ZOOM],
  ['an empty string', '', DEFAULT_MAX_ZOOM],
  ['undefined', undefined, DEFAULT_MAX_ZOOM],
  ['null', null, DEFAULT_MAX_ZOOM],
  ['NaN', NaN, DEFAULT_MAX_ZOOM],
  ['Infinity', Infinity, DEFAULT_MAX_ZOOM],
  ['below 0 (clamped)', -5, 0],
  ['above 24 (clamped)', 99, 24],
])('parses a max zoom given as %s', (_, maxZoom, expected) => {
  expect(
    settingsFor({ max_zoom: maxZoom as VectorTileFormData['max_zoom'] })
      .maxZoom,
  ).toBe(expected);
});

test('falls back to the default min zoom for invalid input', () => {
  expect(settingsFor({ min_zoom: 'abc' }).minZoom).toBe(DEFAULT_MIN_ZOOM);
});

test('swaps min and max zoom when they are reversed', () => {
  const { minZoom, maxZoom } = settingsFor({ min_zoom: 12, max_zoom: 4 });
  expect([minZoom, maxZoom]).toEqual([4, 12]);
});

// Source layer and properties

test('trims names and treats blank ones as unset', () => {
  const settings = settingsFor({
    source_layer: ' places ',
    color_property: ' category ',
    breakpoint_property: '   ',
  });
  expect(settings.sourceLayer).toBe('places');
  expect(settings.colorProperty).toBe('category');
  expect(settings.breakpointProperty).toBeUndefined();
});

test('treats a cleared property (null) as unset', () => {
  expect(settingsFor({ color_property: null }).colorProperty).toBeUndefined();
});

// Colours

test('converts colour alpha from 0–1 to 0–255', () => {
  expect(
    settingsFor({ fill_color_picker: { r: 10, g: 20, b: 30, a: 0.5 } })
      .fillColor,
  ).toEqual([10, 20, 30, 128]);
});

test('uses the chosen default breakpoint colour', () => {
  expect(
    settingsFor({ default_breakpoint_color: { r: 1, g: 2, b: 3, a: 1 } })
      .defaultBreakpointColor,
  ).toEqual([1, 2, 3, 255]);
});

test('keeps complete breakpoints and drops half-saved ones', () => {
  const red = { r: 255, g: 0, b: 0, a: 1 };
  const breakpoints = [
    { minValue: 0, maxValue: 2, color: red },
    { minValue: 2, maxValue: 4 },
    { minValue: NaN, maxValue: 6, color: red },
    { minValue: 6, color: red },
  ] as ColorBreakpointType[];

  expect(
    settingsFor({ color_breakpoints: breakpoints }).colorBreakpoints,
  ).toEqual([{ minValue: 0, maxValue: 2, color: [255, 0, 0, 255] }]);
});
