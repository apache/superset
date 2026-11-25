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
import { ColorType } from '../../types';
import { PRIMARY_COLOR } from '../../utilities/controls';

export const TILE_URL_PLACEHOLDERS = ['{z}', '{x}', '{y}'];
export const DEFAULT_MIN_ZOOM = 0;
export const DEFAULT_MAX_ZOOM = 14;
// Web map tile pyramids practically never go deeper than zoom 24.
const MAX_TILE_ZOOM = 24;

export type RGBAColor = [number, number, number, number];

export interface VectorTileFormData extends QueryFormData {
  tile_url?: string;
  source_layer?: string;
  min_zoom?: number | string;
  max_zoom?: number | string;
  fill_color_picker?: ColorType;
}

export interface VectorTileLayerSettings {
  /** URL template, or null when it is missing {z}, {x} or {y}. */
  tileUrl: string | null;
  /** Layer inside each tile to draw; undefined draws every layer. */
  sourceLayer?: string;
  minZoom: number;
  maxZoom: number;
  fillColor: RGBAColor;
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

/**
 * Normalizes saved form data for the MVTLayer. Called from getLayer because the
 * Multiple Layers chart passes raw form data and skips transformProps.
 */
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
  };
}
