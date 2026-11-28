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
  buildColorExpression,
  compileColorAccessor,
  createColorAccessor,
} from './styling';
import { RGBAColor } from './layerSettings';
import { COLOR_SCHEME_TYPES } from '../../utilities/utils';

const TEAL: RGBAColor = [0, 122, 135, 255];
const GREY: RGBAColor = [158, 158, 158, 255];
const point = (properties: Record<string, unknown>) => ({
  type: 'Feature' as const,
  geometry: { type: 'Point' as const, coordinates: [0, 0] },
  properties,
});

const settings = {
  tileUrl: 'http://tiles/{z}/{x}/{y}',
  minZoom: 0,
  maxZoom: 14,
  fillColor: TEAL,
  colorSchemeType: COLOR_SCHEME_TYPES.categorical_palette,
  colorProperty: 'category',
  colorScheme: 'supersetColors',
  colorBreakpoints: [],
  defaultBreakpointColor: GREY,
};

const breakpointSettings = {
  ...settings,
  colorSchemeType: COLOR_SCHEME_TYPES.color_breakpoints,
  colorProperty: 'rating',
  breakpointProperty: 'rating',
  colorBreakpoints: [
    { minValue: 0, maxValue: 2, color: [255, 0, 0, 255] as RGBAColor },
    { minValue: 2.5, maxValue: 5, color: [0, 0, 255, 255] as RGBAColor },
  ],
};

jest.mock('@superset-ui/core', () => {
  const actual = jest.requireActual('@superset-ui/core');
  return {
    ...actual,
    CategoricalColorNamespace: {
      ...actual.CategoricalColorNamespace,
      getScale: () => (value: string) =>
        value === 'school' ? '#ff0000' : '#00ff00',
    },
  };
});

test('builds an rgba expression with alpha scaled to 0-1', () => {
  expect(buildColorExpression([0, 122, 135, 127.5])).toEqual([
    'rgba',
    0,
    122,
    135,
    0.5,
  ]);
});

test('a fixed colour expression returns the same 0-255 colour', () => {
  const getColor = compileColorAccessor(buildColorExpression(TEAL), TEAL);
  expect(getColor(point({}))).toEqual(TEAL);
});

test('features the expression cannot evaluate get the fallback colour', () => {
  const getColor = compileColorAccessor(
    ['case', ['>', ['to-number', ['get', 'v']], 5], 'red', 'blue'],
    TEAL,
  );
  expect(getColor(point({ v: 'abc' }))).toEqual(TEAL);
});

test('throws when the expression does not compile', () => {
  expect(() =>
    compileColorAccessor(['not-an-operator'] as never, TEAL),
  ).toThrow();
});

test('categorical mode colours features by property value', () => {
  const { getColor } = createColorAccessor(settings, 1);
  expect(getColor(point({ category: 'school' }))).toEqual([255, 0, 0, 255]);
  expect(getColor(point({ category: 'park' }))).toEqual([0, 255, 0, 255]);
});

test('categorical mode without a property falls back to the fixed colour', () => {
  const { getColor } = createColorAccessor(
    { ...settings, colorProperty: undefined },
    1,
  );
  expect(getColor(point({ category: 'school' }))).toEqual(TEAL);
});

test('changing the palette changes the update trigger', () => {
  const a = createColorAccessor(settings, 1).updateTrigger;
  const b = createColorAccessor(
    { ...settings, colorScheme: 'other' },
    1,
  ).updateTrigger;
  expect(a).not.toEqual(b);
});

test('breakpoints colour numeric values, including numbers sent as text', () => {
  const { getColor } = createColorAccessor(breakpointSettings);
  expect(getColor(point({ rating: '1.7' }))).toEqual([255, 0, 0, 255]);
  expect(getColor(point({ rating: 5 }))).toEqual([0, 0, 255, 255]);
});

test('breakpoints use the default colour for gaps, missing and non-numeric values', () => {
  const { getColor } = createColorAccessor(breakpointSettings);
  expect(getColor(point({ rating: 2.2 }))).toEqual(GREY);
  expect(getColor(point({}))).toEqual(GREY);
  expect(getColor(point({ rating: null }))).toEqual(GREY);
  expect(getColor(point({ rating: 'abc' }))).toEqual(GREY);
  expect(getColor(point({ rating: '' }))).toEqual(GREY);
  expect(getColor(point({ rating: true }))).toEqual(GREY);
  expect(getColor(point({ rating: false }))).toEqual(GREY);
});

test('breakpoints ignore the categorical property', () => {
  const { getColor } = createColorAccessor({
    ...breakpointSettings,
    colorProperty: 'rating',
    breakpointProperty: undefined,
  });
  expect(getColor(point({ rating: 1 }))).toEqual(TEAL);
});
