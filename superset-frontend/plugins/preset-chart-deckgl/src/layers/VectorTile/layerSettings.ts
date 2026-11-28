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
import { ColorBreakpointType, ColorType } from '../../types';
import { PRIMARY_COLOR } from '../../utilities/controls';
import { COLOR_SCHEME_TYPES, ColorSchemeType } from '../../utilities/utils';
import { DEFAULT_DECKGL_COLOR } from '../../utilities/Shared_DeckGL';
import { LegendProps } from '../../components/Legend';

export const TILE_URL_PLACEHOLDERS = ['{z}', '{x}', '{y}'];
export const DEFAULT_MIN_ZOOM = 0;
export const DEFAULT_MAX_ZOOM = 14;
// Web map tile pyramids practically never go deeper than zoom 24.
const MAX_TILE_ZOOM = 24;

export type RGBAColor = [number, number, number, number];

export interface ColorRange {
  minValue: number;
  maxValue: number;
  color: RGBAColor;
}

export interface VectorTileFormData extends QueryFormData {
  tile_url?: string;
  source_layer?: string;
  min_zoom?: number | string;
  max_zoom?: number | string;
  fill_color_picker?: ColorType;
  tooltip_properties?: string[];
  color_scheme_type?: ColorSchemeType;
  color_property?: string | null;
  breakpoint_property?: string | null;
  color_scheme?: string;
  color_breakpoints?: ColorBreakpointType[];
  default_breakpoint_color?: ColorType;
  legend_position?: LegendProps['position'];
  legend_format?: string;
}

export interface VectorTileLayerSettings {
  /** URL template, or null when it is missing {z}, {x} or {y}. */
  tileUrl: string | null;
  /** Layer inside each tile to draw; undefined draws every layer. */
  sourceLayer?: string;
  minZoom: number;
  maxZoom: number;
  fillColor: RGBAColor;
  colorSchemeType: ColorSchemeType;
  /** Property whose values pick categorical colours; undefined when none is chosen. */
  colorProperty?: string;
  /** Numeric property compared against the breakpoints; undefined when none is chosen. */
  breakpointProperty?: string;
  /** Categorical palette name; undefined uses Superset's default palette. */
  colorScheme?: string;
  colorBreakpoints: ColorRange[];
  defaultBreakpointColor: RGBAColor;
}

/** True when the value is a tile URL template containing {z}, {x} and {y}. */
export const isTileUrlTemplate = (value: unknown): value is string =>
  typeof value === 'string' &&
  TILE_URL_PLACEHOLDERS.every(placeholder => value.includes(placeholder));

/** Parses a zoom level, falling back when missing and clamping to 0–24. */
const parseZoom = (value: unknown, fallback: number): number => {
  const parsed =
    typeof value === 'number' ? value : parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.min(Math.max(Math.round(parsed), 0), MAX_TILE_ZOOM);
};

/** Converts Superset's {r, g, b, a: 0–1} colour to deck.gl's [r, g, b, a: 0–255]. */
const toRGBA = ({ r, g, b, a }: ColorType): RGBAColor => [
  r,
  g,
  b,
  Math.round(a * 255),
];

/** Normalizes saved form data for the MVTLayer. */
export function getLayerSettings(
  formData: VectorTileFormData,
): VectorTileLayerSettings {
  const tileUrl = formData.tile_url?.trim() ?? '';
  const sourceLayer = formData.source_layer?.trim();
  const minZoom = parseZoom(formData.min_zoom, DEFAULT_MIN_ZOOM);
  const maxZoom = parseZoom(formData.max_zoom, DEFAULT_MAX_ZOOM);

  return {
    tileUrl: isTileUrlTemplate(tileUrl) ? tileUrl : null,
    sourceLayer: sourceLayer || undefined,
    minZoom: Math.min(minZoom, maxZoom),
    maxZoom: Math.max(minZoom, maxZoom),
    fillColor: toRGBA(formData.fill_color_picker ?? PRIMARY_COLOR),
    colorSchemeType:
      formData.color_scheme_type ?? COLOR_SCHEME_TYPES.fixed_color,
    colorProperty: formData.color_property?.trim() || undefined,
    breakpointProperty: formData.breakpoint_property?.trim() || undefined,
    colorScheme: formData.color_scheme,
    colorBreakpoints: (formData.color_breakpoints ?? [])
      .filter(
        ({ minValue, maxValue, color }) =>
          Number.isFinite(minValue) && Number.isFinite(maxValue) && color,
      )
      .map(({ minValue, maxValue, color }) => ({
        minValue,
        maxValue,
        color: toRGBA(color),
      })),
    defaultBreakpointColor: toRGBA(
      formData.default_breakpoint_color ?? DEFAULT_DECKGL_COLOR,
    ),
  };
}
