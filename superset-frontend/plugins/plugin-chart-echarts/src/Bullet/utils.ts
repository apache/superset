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
// Ported from the nvd3 bullet chart so saved comma-separated control values
// keep their exact semantics.
export function tokenizeToNumericArray(value?: string): number[] | null {
  if (!value?.trim()) return null;
  // Lenient by design: this runs on every keystroke, so partial input like
  // "50," must not throw. Empty, non-numeric, and non-finite tokens (e.g.
  // "Infinity", or a value large enough to overflow to it) are dropped.
  // `BulletRangeColorsControl` shares this exact function (not a
  // reimplementation) since its per-range colors are matched positionally
  // against this same tokenized list -- a divergent tokenizer would
  // silently misalign colors to the wrong bands.
  const numbers = value
    .split(',')
    .map(token => token.trim())
    .filter(token => token !== '')
    .map(token => Number(token))
    .filter(n => Number.isFinite(n));
  return numbers.length ? numbers : null;
}

export function tokenizeToStringArray(value?: string): string[] | null {
  if (!value?.trim()) return null;
  return value.split(',').map(token => token.trim());
}

/**
 * Whether every comma-separated token in `value` is itself a complete,
 * valid number -- i.e. the string isn't in a transient, mid-edit state such
 * as "20,,60" (a blank token between two valid ones). A single blank
 * trailing token (e.g. "20,40,") is tolerated, since that's the normal shape
 * of the string while the user is still typing the next value.
 *
 * `tokenizeToNumericArray` is deliberately lenient (it silently drops blank
 * tokens so partial input never throws), which is right for parsing the
 * list once it's complete but wrong for anything that positionally matches
 * against it, like `BulletRangeColorsControl`'s per-range colors -- a blank
 * in the middle must not be treated as "one fewer range" there, since a
 * color edit made while the list is in that transient state would
 * permanently misalign once the blank is filled back in.
 */
export function isRangesInputComplete(value?: string): boolean {
  if (!value?.trim()) return true;
  const tokens = value.split(',').map(token => token.trim());
  const tokensToValidate =
    tokens[tokens.length - 1] === '' ? tokens.slice(0, -1) : tokens;
  return (
    tokensToValidate.length > 0 &&
    tokensToValidate.every(
      token => token !== '' && Number.isFinite(Number(token)),
    )
  );
}

/**
 * Relative luminance (0-1) of a `#rgb` / `#rrggbb` / `#rrggbbaa` / `rgb[a]()`
 * color, or `null` when the value cannot be parsed or is mostly transparent
 * (alpha below 0.5), in which case the theme background shows through and the
 * fill alone says nothing about contrast. Mostly-opaque fills are measured by
 * their own channels, so a near-opaque `#000000fc` still reads as dark.
 */
const MIN_LUMINANCE_ALPHA = 0.5;

export function getColorLuminance(color: string): number | null {
  const value = color.trim().toLowerCase();
  let channels: number[] | null = null;
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/.exec(value);
  if (hex) {
    const digits =
      hex[1].length === 3
        ? hex[1]
            .split('')
            .map(c => c + c)
            .join('')
        : hex[1];
    if (
      digits.length === 8 &&
      parseInt(digits.slice(6), 16) / 255 < MIN_LUMINANCE_ALPHA
    ) {
      return null;
    }
    channels = [0, 2, 4].map(i => parseInt(digits.slice(i, i + 2), 16));
  } else {
    const rgb =
      /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)$/.exec(
        value,
      );
    if (
      rgb &&
      (rgb[4] === undefined || Number(rgb[4]) >= MIN_LUMINANCE_ALPHA)
    ) {
      channels = [rgb[1], rgb[2], rgb[3]].map(Number);
    }
  }
  if (!channels) return null;
  const [r, g, b] = channels.map(channel => {
    const c = channel / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
