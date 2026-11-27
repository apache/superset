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
import { RGBAColor } from './layerSettings';

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

// Evaluated per feature, not per zoom level.
const GLOBALS = { zoom: 0 };

const colorPropertySpec = ([
  r,
  g,
  b,
  a,
]: RGBAColor): StylePropertySpecification => ({
  type: 'color',
  'property-type': 'data-driven',
  expression: { interpolated: false, parameters: ['feature'] },
  transition: false,
  overridable: false,
  // Returned when the expression fails for a feature, e.g. text that is not a number.
  default: `rgba(${r}, ${g}, ${b}, ${a / 255})`,
});

/**
 * Compiles a colour expression into a deck.gl accessor that returns
 * 0–255 RGBA for each tile feature. Features the expression cannot
 * evaluate get `fallback`.
 */
export function compileColorAccessor(
  expression: ExpressionSpecification,
  fallback: RGBAColor,
): (feature: Feature) => RGBAColor {
  const compiled = createExpression(
    expression,
    'vector-tile-color',
    colorPropertySpec(fallback),
  );
  if (compiled.result === 'error') {
    throw new Error(compiled.value.map(error => error.message).join('; '));
  }
  const styleExpression = compiled.value;

  return feature => {
    const color = styleExpression.evaluate(GLOBALS, {
      type: (feature.geometry?.type ?? 'Unknown') as StyleFeature['type'],
      properties: feature.properties ?? {},
    }) as Color;
    const [r, g, b, a] = color.rgb;
    return [r * 255, g * 255, b * 255, a * 255];
  };
}
