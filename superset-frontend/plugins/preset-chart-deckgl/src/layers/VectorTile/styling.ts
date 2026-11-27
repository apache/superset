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
  Color,
  createExpression,
  ExpressionSpecification,
  Feature as StyleFeature,
  StylePropertySpecification,
} from '@maplibre/maplibre-gl-style-spec';
// eslint-disable-next-line import/no-unresolved
import { Feature } from 'geojson';
import { CategoricalColorNamespace } from '@superset-ui/core';
import { hexToRGB } from '../../utils/colors';
import { NULL_CATEGORY_KEY } from '../../utils';
import { COLOR_SCHEME_TYPES } from '../../utilities/utils';
import {
  ColorRange,
  RGBAColor,
  VectorTileLayerSettings,
} from './layerSettings';

/** Turns a deck.gl colour (0–255 channels) into a MapLibre `rgba` expression. */
export const toRgbaExpression = ([
  r,
  g,
  b,
  a,
]: RGBAColor): ExpressionSpecification => ['rgba', r, g, b, a / 255];

/** Builds the MapLibre expression that decides each feature's colour. */
export function buildColorExpression(
  fillColor: RGBAColor,
): ExpressionSpecification {
  return toRgbaExpression(fillColor);
}

/**
 * Colours features by numeric ranges, inclusive at both ends. The first
 * matching range wins. Missing values, values in no range, and text that is
 * not a number get `fallback`.
 */
export function buildBreakpointExpression(
  property: string,
  breakpoints: ColorRange[],
  fallback: RGBAColor,
): ExpressionSpecification {
  const value: ExpressionSpecification = ['to-number', ['get', property]];
  const ranges = breakpoints.flatMap(({ minValue, maxValue, color }) => [
    ['all', ['>=', value, minValue], ['<=', value, maxValue]],
    toRgbaExpression(color),
  ]);
  return [
    'case',
    // Checked before to-number, which turns null into 0.
    ['==', ['get', property], null],
    toRgbaExpression(fallback),
    ...ranges,
    toRgbaExpression(fallback),
  ] as ExpressionSpecification;
}

// Evaluated per feature, not per zoom level.
const GLOBALS = { zoom: 0 };
const FEATURE_EXPRESSION: {
  interpolated: boolean;
  parameters: Array<'feature'>;
} = {
  interpolated: false,
  parameters: ['feature'],
};

const colorPropertySpec = ([
  r,
  g,
  b,
  a,
]: RGBAColor): StylePropertySpecification => ({
  type: 'color',
  'property-type': 'data-driven',
  expression: FEATURE_EXPRESSION,
  transition: false,
  overridable: false,
  // Returned when the expression fails for a feature, e.g. text that is not a number.
  default: `rgba(${r}, ${g}, ${b}, ${a / 255})`,
});

/** The shape the style-spec evaluator expects for a deck.gl GeoJSON feature. */
const toStyleFeature = (feature: Feature): StyleFeature => ({
  type: (feature.geometry?.type ?? 'Unknown') as StyleFeature['type'],
  properties: feature.properties ?? {},
});

/** Compiles an expression once and returns a per-feature evaluator. */
function compileFeatureExpression<T>(
  expression: ExpressionSpecification,
  rootKey: string,
  propertySpec: StylePropertySpecification,
): (feature: Feature) => T {
  const compiled = createExpression(expression, rootKey, propertySpec);
  if (compiled.result === 'error') {
    throw new Error(compiled.value.map(error => error.message).join('; '));
  }
  const styleExpression = compiled.value;
  return feature =>
    styleExpression.evaluate(GLOBALS, toStyleFeature(feature)) as T;
}

/**
 * Compiles a colour expression into a deck.gl accessor that returns
 * 0–255 RGBA for each tile feature. Features the expression cannot
 * evaluate get `fallback`.
 */
export function compileColorAccessor(
  expression: ExpressionSpecification,
  fallback: RGBAColor,
): (feature: Feature) => RGBAColor {
  const evaluate = compileFeatureExpression<Color>(
    expression,
    'vector-tile-color',
    colorPropertySpec(fallback),
  );
  return feature => {
    const [r, g, b, a] = evaluate(feature).rgb;
    return [r * 255, g * 255, b * 255, a * 255];
  };
}

/**
 * Reads a property as category text, matching other deck.gl charts:
 * values become strings and missing values become NULL_CATEGORY_KEY.
 */
export const buildCategoryExpression = (
  property: string,
): ExpressionSpecification => [
  'case',
  ['==', ['get', property], null],
  NULL_CATEGORY_KEY,
  ['to-string', ['get', property]],
];

const categoryPropertySpec: StylePropertySpecification = {
  type: 'string',
  'property-type': 'data-driven',
  expression: FEATURE_EXPRESSION,
  transition: false,
  default: NULL_CATEGORY_KEY,
};

type CategoryScale = ReturnType<typeof CategoricalColorNamespace.getScale>;
const categoryScales = new Map<string, CategoryScale>();

/**
 * Returns one colour scale per chart and palette. getScale() builds a new
 * scale on every call, and a new scale forgets which colour each value has.
 */
function getCategoryScale(
  colorScheme: string | undefined,
  sliceId: number | undefined,
): CategoryScale {
  const key = `${sliceId ?? ''}:${colorScheme ?? ''}`;
  let scale = categoryScales.get(key);
  if (!scale) {
    scale = CategoricalColorNamespace.getScale(colorScheme);
    categoryScales.set(key, scale);
  }
  return scale;
}

export function createCategoryColor(
  colorScheme: string | undefined,
  alpha: number,
  sliceId?: number,
): (category: string) => RGBAColor {
  const scale = getCategoryScale(colorScheme, sliceId);
  return category => hexToRGB(scale(category, sliceId), alpha);
}

export interface ColorAccessor {
  getColor: (feature: Feature) => RGBAColor;
  /** Changes whenever colours must be recomputed; used for updateTriggers. */
  updateTrigger: string;
}

/** Builds the per-feature colour accessor for the chosen colour mode. */
export function createColorAccessor(
  {
    colorSchemeType,
    colorProperty,
    colorScheme,
    fillColor,
    colorBreakpoints,
    defaultBreakpointColor,
    breakpointProperty,
  }: VectorTileLayerSettings,
  sliceId?: number,
): ColorAccessor {
  if (
    colorSchemeType === COLOR_SCHEME_TYPES.categorical_palette &&
    colorProperty
  ) {
    const expression = buildCategoryExpression(colorProperty);
    const readCategory = compileFeatureExpression<string>(
      expression,
      'vector-tile-category',
      categoryPropertySpec,
    );
    // Opacity follows the fixed colour, as in other categorical deck.gl charts.
    const colorFor = createCategoryColor(colorScheme, fillColor[3], sliceId);
    return {
      getColor: feature => colorFor(readCategory(feature)),
      updateTrigger: JSON.stringify([expression, colorScheme, fillColor[3]]),
    };
  }

  if (
    colorSchemeType === COLOR_SCHEME_TYPES.color_breakpoints &&
    breakpointProperty
  ) {
    const expression = buildBreakpointExpression(
      breakpointProperty,
      colorBreakpoints,
      defaultBreakpointColor,
    );
    return {
      // Text that is not a number makes to-number fail; the spec's default
      // (this fallback) is used then.
      getColor: compileColorAccessor(expression, defaultBreakpointColor),
      updateTrigger: JSON.stringify(expression),
    };
  }

  const expression = buildColorExpression(fillColor);
  return {
    getColor: compileColorAccessor(expression, fillColor),
    updateTrigger: JSON.stringify(expression),
  };
}
