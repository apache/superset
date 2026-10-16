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
import type { RgbaColor } from '@superset-ui/core';

const HEX_COLOR = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

const isChannel = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

/**
 * Coerce a saved color control value into an `{r, g, b, a}` object.
 *
 * Several charts share the `increase_color` / `decrease_color` control names
 * but store different shapes (`{r, g, b, a}` objects for Waterfall and
 * Candlestick, hex strings for Big Number with Time Period Comparison).
 * Switching the viz type keeps the saved value, so readers that expect an RGB
 * object must tolerate a hex string instead of throwing on `undefined`
 * channels. Anything unrecognized falls back to `fallback`.
 */
export function normalizeRgbaColor(
  color: unknown,
  fallback: RgbaColor,
): RgbaColor {
  if (color && typeof color === 'object') {
    const { r, g, b, a } = color as Partial<RgbaColor>;
    if (isChannel(r) && isChannel(g) && isChannel(b)) {
      return { r, g, b, a: isChannel(a) ? a : 1 };
    }
  }
  if (typeof color === 'string') {
    const match = HEX_COLOR.exec(color.trim());
    if (match) {
      const digits =
        match[1].length === 3
          ? match[1]
              .split('')
              .map(c => c + c)
              .join('')
          : match[1];
      const [r, g, b] = [0, 2, 4].map(i =>
        parseInt(digits.slice(i, i + 2), 16),
      );
      return { r, g, b, a: 1 };
    }
  }
  return fallback;
}
