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
import { getCategories } from './CategoricalDeckGLContainer';
import { addColorToFeatures } from './utils/addColor';
import { COLOR_SCHEME_TYPES } from './utilities/utils';

// Record every (label, sliceId) pair the categorical color scale is asked to
// resolve, so we can assert the legend and point-color paths key the scale on
// the same slice id.
const scaleCalls: [string, number | undefined][] = [];
jest.mock('@superset-ui/core', () => {
  const actual = jest.requireActual('@superset-ui/core');
  return {
    ...actual,
    CategoricalColorNamespace: {
      ...actual.CategoricalColorNamespace,
      getScale: () => (value: string, sliceId?: number) => {
        scaleCalls.push([value, sliceId]);
        return value === 'A' ? '#ff0000' : '#00ff00';
      },
    },
  };
});

test('legend and point colors resolve from the same slice_id', () => {
  const fd = {
    datasource: '1__table',
    viz_type: 'deck_scatter',
    color_scheme_type: COLOR_SCHEME_TYPES.categorical_palette,
    color_scheme: 'supersetColors',
    dimension: 'category',
    slice_id: 42,
    color_picker: { r: 0, g: 0, b: 0, a: 1 },
  } as unknown as QueryFormData;
  const data = [{ cat_color: 'A' }, { cat_color: 'B' }];

  const categories = getCategories(fd, data);
  const features = addColorToFeatures(data, fd);

  // Both the legend path (getCategories) and the point-color path
  // (addColorToFeatures) key the color scale on the same slice id.
  expect(scaleCalls.length).toBeGreaterThan(0);
  scaleCalls.forEach(([, sliceId]) => {
    expect(sliceId).toBe(42);
  });

  // The legend swatch for each category matches the resolved point color.
  expect(categories.A.color).toEqual(features[0].color);
  expect(categories.B.color).toEqual(features[1].color);
  expect(features[0].color).not.toEqual(features[1].color);
});
