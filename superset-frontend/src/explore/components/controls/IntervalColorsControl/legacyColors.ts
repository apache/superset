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
  getCategoricalSchemeRegistry,
  validateNumber,
} from '@superset-ui/core';

export const parseIntervalBounds = (intervals?: string): number[] =>
  (intervals ?? '')
    .split(',')
    .map(part => part.trim())
    .filter(part => part !== '')
    .map(Number)
    .filter(bound => Number.isFinite(bound));

/**
 * Resolves the legacy `interval_color_indices` control (comma-separated,
 * 1-indexed positions into the chosen categorical color scheme) into real
 * hex colors, positionally matched to `bounds`. Shared by the control panel
 * (display-only fallback while a legacy chart is being edited) and by
 * `handleDeprecatedControls` (which migrates the value into `interval_colors`
 * on load, since `interval_color_indices` is no longer a registered control
 * and would otherwise be silently dropped on the next save).
 */
export const resolveLegacyIntervalColors = (
  bounds: number[],
  legacyIntervalColorIndices: string | undefined,
  colorScheme: string | undefined,
): string[] => {
  // Non-strict lookup mirrors the Gauge renderer: an unregistered scheme
  // falls back to the registry's default scheme.
  const schemeColors =
    getCategoricalSchemeRegistry().get(colorScheme)?.colors ?? [];
  // Parse with the exact same semantics `getIntervalBoundsAndColors` in
  // Gauge/transformProps.ts uses for this same legacy fallback (via
  // `parseNumbersList`, not reimported here to avoid pulling the whole
  // `@superset-ui/plugin-chart-echarts` package -- and every chart plugin it
  // eagerly registers -- into `explore/store.ts`'s import graph): one
  // unparseable (or blank) token discards every legacy index for the whole
  // list, rather than resolving the other tokens independently. A more
  // lenient parser here would let this one-time migration (and this
  // display-only preview) disagree with how an untouched legacy chart has
  // always rendered -- see #42910 review thread on this file.
  let indices: number[];
  try {
    indices = (legacyIntervalColorIndices ?? '').split(',').map(part => {
      if (validateNumber(part)) throw new Error('All values must be numeric');
      return Number(part);
    });
  } catch {
    indices = [];
  }
  // An index past the static palette can only be resolved against the
  // renderer's render-time palette (which grows under USE_ANALOGOUS_COLORS),
  // so wrapping it modulo the static scheme would show -- and, once a row is
  // edited, persist -- a different color than the chart renders. Leave every
  // band unresolved so such charts keep rendering through the renderer's own
  // legacy path.
  if (indices.some(index => index > schemeColors.length)) {
    return bounds.map(() => '');
  }
  // Bounds without an explicit legacy index keep their positional color,
  // exactly as the Gauge renderer does (`colors[idx]`). Indices below 1 are
  // not valid 1-indexed positions: the renderer yields `undefined` for them
  // and falls back to that same positional color, so this does too.
  return bounds.map((_, index) => {
    const legacyIndex = indices[index];
    if (schemeColors.length === 0) return '';
    if (Number.isFinite(legacyIndex) && legacyIndex >= 1) {
      return schemeColors[(legacyIndex - 1) % schemeColors.length];
    }
    return schemeColors[index % schemeColors.length];
  });
};
