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
  const schemeColors =
    getCategoricalSchemeRegistry().get(colorScheme)?.colors ?? [];
  const indices = (legacyIntervalColorIndices ?? '')
    .split(',')
    .map(part => part.trim())
    .map(part => (part === '' ? NaN : Number(part)));
  return bounds.map((_, index) => {
    const legacyIndex = indices[index];
    if (schemeColors.length === 0) return '';
    if (Number.isFinite(legacyIndex)) {
      return schemeColors[
        (((legacyIndex - 1) % schemeColors.length) + schemeColors.length) %
          schemeColors.length
      ];
    }
    return schemeColors[index % schemeColors.length];
  });
};
