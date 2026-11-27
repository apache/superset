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

import { buildCategoryLegend, getLegendCategories } from './legend';
import { NULL_CATEGORY_KEY } from '../../utils';
import { COLOR_SCHEME_TYPES } from '../../utilities/utils';
import { RGBAColor } from './layerSettings';

const RED: RGBAColor = [255, 0, 0, 255];
const feature = (properties: Record<string, unknown>) => ({
  type: 'Feature' as const,
  geometry: { type: 'Point' as const, coordinates: [0, 0] },
  properties,
});

test('lists categories by frequency, with missing values as the null category', () => {
  const features = [
    feature({ category: 'park' }),
    feature({ category: 'school' }),
    feature({ category: 'school' }),
    feature({}),
  ];
  expect(
    Object.keys(buildCategoryLegend(features, 'category', () => RED)),
  ).toEqual(['school', NULL_CATEGORY_KEY, 'park']);
});

test('caps the rows and summarises the rest', () => {
  const features = ['a', 'b', 'c', 'd'].map(category => feature({ category }));
  const legend = buildCategoryLegend(features, 'category', () => RED, 2);
  expect(Object.keys(legend)).toEqual(['a', 'b', '+ 2 more']);
  expect(legend['+ 2 more'].color).toBeUndefined();
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
