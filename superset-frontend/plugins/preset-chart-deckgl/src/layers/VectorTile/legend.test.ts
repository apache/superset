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

import {
  buildCategoryLegend,
  getLegendCategories,
  readTileValues,
} from './legend';
import { NULL_CATEGORY_KEY } from '../../utils';
import { COLOR_SCHEME_TYPES } from '../../utilities/utils';
import { RGBAColor } from './layerSettings';

const RED: RGBAColor = [255, 0, 0, 255];
const feature = (properties: Record<string, unknown>) => ({
  type: 'Feature' as const,
  geometry: { type: 'Point' as const, coordinates: [0, 0] },
  properties,
});

const binaryTile = {
  content: {
    points: {
      // The third point is in the buffer, outside the tile (x = 1.02).
      positions: {
        value: new Float32Array([0.1, 0.1, 0.5, 0.5, 1.02, 0.5]),
        size: 2,
      },
      featureIds: { value: new Uint16Array([0, 1, 2]) },
      numericProps: { visitors: { value: new Float32Array([10, 20, 30]) } },
      properties: [
        { category: 'cafe' },
        { category: 'park' },
        { category: 'cafe' },
      ],
    },
    lines: {
      // One line with two vertices: counted once.
      positions: {
        value: new Float32Array([0.1, 0.1, 0.2, 0.2, -0.01, 0.5, 0.3, 0.5]),
        size: 2,
      },
      featureIds: { value: new Uint16Array([0, 0, 1, 1]) },
      numericProps: {},
      properties: [{ category: 'road' }, { category: 'river' }],
    },
  },
};

test('lists categories by frequency, with missing values as the null category', () => {
  expect(
    Object.keys(
      buildCategoryLegend(['park', 'school', 'school', undefined], () => RED),
    ),
  ).toEqual(['school', NULL_CATEGORY_KEY, 'park']);
});

test('caps the rows and summarises the rest', () => {
  const legend = buildCategoryLegend(['a', 'b', 'c', 'd'], () => RED, 2);
  expect(Object.keys(legend)).toEqual(['a', 'b', '+ 2 more']);
  expect(legend['+ 2 more'].color).toEqual([0, 0, 0, 0]);
});

test('fixed colour has no legend', () => {
  const settings = {
    tileUrl: 'http://tiles/{z}/{x}/{y}',
    minZoom: 0,
    maxZoom: 14,
    fillColor: RED,
    colorSchemeType: COLOR_SCHEME_TYPES.fixed_color,
    colorBreakpoints: [],
    defaultBreakpointColor: RED,
  };
  expect(getLegendCategories(settings, [])).toEqual({});
});

test('skips buffer copies of points', () => {
  expect(
    readTileValues(
      [{ content: { points: binaryTile.content.points } }],
      'category',
    ),
  ).toEqual(['cafe', 'park']);
});

test('counts a line once per tile, even with many vertices', () => {
  expect(
    readTileValues(
      [{ content: { lines: binaryTile.content.lines } }],
      'category',
    ),
  ).toEqual(['road', 'river']);
});

test('reads GeoJSON tiles and skips tiles that are still loading', () => {
  const tiles = [
    { content: [feature({ category: 'school' })] },
    { content: null },
    {},
  ];
  expect(readTileValues(tiles, 'category')).toEqual(['school']);
});
