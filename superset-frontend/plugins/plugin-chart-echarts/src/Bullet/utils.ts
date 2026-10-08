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
