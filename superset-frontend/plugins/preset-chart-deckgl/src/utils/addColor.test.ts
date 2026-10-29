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
import { QueryFormData } from '@superset-ui/core';
import { addColorToFeatures } from './addColor';
import { COLOR_SCHEME_TYPES } from '../utilities/utils';

const baseFormData = {
  datasource: '1__table',
  viz_type: 'deck_scatter',
} as unknown as QueryFormData;

test('assigns distinct colors per category for a categorical palette', () => {
  const features = [{ cat_color: 'A' }, { cat_color: 'B' }, { cat_color: 'A' }];
  const result = addColorToFeatures(features, {
    ...baseFormData,
    color_scheme_type: COLOR_SCHEME_TYPES.categorical_palette,
    color_scheme: 'supersetColors',
    dimension: 'category',
    slice_id: 1,
  } as unknown as QueryFormData);

  // Each feature gets a resolved RGBA color
  result.forEach(d => {
    expect(Array.isArray(d.color)).toBe(true);
    expect(d.color).toHaveLength(4);
  });
  // Same category resolves to the same color, different categories differ
  expect(result[0].color).toEqual(result[2].color);
  expect(result[0].color).not.toEqual(result[1].color);
});

test('falls back to the fixed color picker when no dimension is set', () => {
  const features = [{ cat_color: 'A' }, { cat_color: 'B' }];
  const result = addColorToFeatures(features, {
    ...baseFormData,
    color_scheme_type: COLOR_SCHEME_TYPES.categorical_palette,
    color_picker: { r: 10, g: 20, b: 30, a: 1 },
  } as unknown as QueryFormData);

  result.forEach(d => {
    expect(d.color).toEqual([10, 20, 30, 255]);
  });
});

test('applies the fixed color scheme to every feature', () => {
  const features = [{ cat_color: 'A' }, { cat_color: 'B' }];
  const result = addColorToFeatures(features, {
    ...baseFormData,
    color_scheme_type: COLOR_SCHEME_TYPES.fixed_color,
    color_picker: { r: 1, g: 2, b: 3, a: 0.5 },
  } as unknown as QueryFormData);

  result.forEach(d => {
    expect(d.color).toEqual([1, 2, 3, 127.5]);
  });
});

test('assigns breakpoint colors by metric and falls back to the default', () => {
  const features = [{ metric: 5 }, { metric: 50 }, { metric: 500 }];
  const result = addColorToFeatures(features, {
    ...baseFormData,
    color_scheme_type: COLOR_SCHEME_TYPES.color_breakpoints,
    color_breakpoints: [
      { minValue: 0, maxValue: 10, color: { r: 1, g: 2, b: 3, a: 1 } },
      { minValue: 11, maxValue: 100, color: { r: 4, g: 5, b: 6, a: 0.5 } },
    ],
    default_breakpoint_color: { r: 7, g: 8, b: 9, a: 1 },
  } as unknown as QueryFormData);

  // Metric inside the first breakpoint range
  expect(result[0].color).toEqual([1, 2, 3, 255]);
  // Metric inside the second breakpoint range (alpha scaled to 0-255)
  expect(result[1].color).toEqual([4, 5, 6, 127.5]);
  // Metric outside every range falls back to the default breakpoint color
  expect(result[2].color).toEqual([7, 8, 9, 255]);
});

test('returns features unchanged for an unrecognized color scheme', () => {
  const features = [{ cat_color: 'A' }];
  const result = addColorToFeatures(features, {
    ...baseFormData,
    color_scheme_type: 'something_else',
  } as unknown as QueryFormData);

  expect(result).toEqual(features);
  expect(result[0].color).toBeUndefined();
});
