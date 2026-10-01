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
import { getCategoricalSchemeRegistry } from '@superset-ui/core';

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
  // strict: an explicitly-named but unregistered scheme should resolve to
  // "no colors" here, not silently fall back to the registry's default
  // scheme -- that fallback belongs to the display layer (index.tsx), not
  // to this migration helper.
  const schemeColors =
    getCategoricalSchemeRegistry().get(colorScheme, true)?.colors ?? [];
  const indices = (legacyIntervalColorIndices ?? '')
    .split(',')
    .map(part => part.trim())
    .map(part => (part === '' ? NaN : Number(part)));
  // Bounds without an explicit legacy index cycle through the scheme on
  // their own counter, independent of their position among the bounds that
  // *do* have one -- e.g. indices "2,3" for 3 bounds should leave the third
  // (uncovered) bound on the first scheme color, not the third.
  let missingCount = 0;
  return bounds.map((_, index) => {
    const legacyIndex = indices[index];
    if (schemeColors.length === 0) return '';
    if (Number.isFinite(legacyIndex)) {
      return schemeColors[
        (((legacyIndex - 1) % schemeColors.length) + schemeColors.length) %
          schemeColors.length
      ];
    }
    const fallbackColor = schemeColors[missingCount % schemeColors.length];
    missingCount += 1;
    return fallbackColor;
  });
};
