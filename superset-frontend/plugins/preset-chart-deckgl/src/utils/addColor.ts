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
  CategoricalColorNamespace,
  JsonObject,
  QueryFormData,
} from '@superset-ui/core';
import { hexToRGB } from './colors';
import { ColorBreakpointType } from '../types';
import { COLOR_SCHEME_TYPES, ColorSchemeType } from '../utilities/utils';
import { DEFAULT_DECKGL_COLOR } from '../utilities/Shared_DeckGL';

const { getScale } = CategoricalColorNamespace;

/**
 * Resolve the per-feature color for a deck.gl layer based on the form data's
 * color scheme configuration. This mirrors the categorical/fixed/breakpoint
 * color logic that `CategoricalDeckGLContainer` applies when a layer is
 * rendered on its own, so that it can be reused when layers are composed
 * inside the deck.gl Multiple Layers chart.
 *
 * Features whose color scheme is not recognized are returned unchanged so the
 * layer's own fallback color logic can take over.
 */
export function addColorToFeatures(
  data: JsonObject[],
  fd: QueryFormData,
  selectedColorScheme: ColorSchemeType = fd.color_scheme_type,
): JsonObject[] {
  const appliedScheme = fd.color_scheme;
  const colorFn = getScale(appliedScheme);

  switch (selectedColorScheme) {
    case COLOR_SCHEME_TYPES.fixed_color: {
      const color = fd.color_picker || { r: 0, g: 0, b: 0, a: 1 };
      const colorArray = [color.r, color.g, color.b, color.a * 255];

      return data.map(d => ({ ...d, color: colorArray }));
    }
    case COLOR_SCHEME_TYPES.categorical_palette: {
      if (!fd.dimension) {
        const fallbackColor = fd.color_picker || { r: 0, g: 0, b: 0, a: 1 };
        const colorArray = [
          fallbackColor.r,
          fallbackColor.g,
          fallbackColor.b,
          fallbackColor.a * 255,
        ];
        return data.map(d => ({ ...d, color: colorArray }));
      }

      return data.map(d => ({
        ...d,
        color: hexToRGB(colorFn(d.cat_color, fd.slice_id)),
      }));
    }
    case COLOR_SCHEME_TYPES.color_breakpoints: {
      const defaultBreakpointColor = fd.default_breakpoint_color
        ? [
            fd.default_breakpoint_color.r,
            fd.default_breakpoint_color.g,
            fd.default_breakpoint_color.b,
            fd.default_breakpoint_color.a * 255,
          ]
        : [
            DEFAULT_DECKGL_COLOR.r,
            DEFAULT_DECKGL_COLOR.g,
            DEFAULT_DECKGL_COLOR.b,
            DEFAULT_DECKGL_COLOR.a * 255,
          ];
      return data.map(d => {
        const breakpointForPoint: ColorBreakpointType =
          fd.color_breakpoints?.find(
            (breakpoint: ColorBreakpointType) =>
              d.metric >= breakpoint.minValue &&
              d.metric <= breakpoint.maxValue,
          );

        if (breakpointForPoint) {
          const pointColor = [
            breakpointForPoint.color.r,
            breakpointForPoint.color.g,
            breakpointForPoint.color.b,
            breakpointForPoint.color.a * 255,
          ];
          return { ...d, color: pointColor };
        }

        return { ...d, color: defaultBreakpointColor };
      });
    }
    default:
      return data;
  }
}
