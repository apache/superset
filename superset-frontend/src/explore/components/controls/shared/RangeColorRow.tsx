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
import { styled } from '@apache-superset/core/theme';

/**
 * Shared row layout for the Gauge (`IntervalColorsControl`) and Bullet
 * (`BulletRangeColorsControl`) per-threshold color editors. Both controls
 * render one row per parsed threshold with a label and a `ColorPickerControl`;
 * this is the layout piece they have in common. Row *content* (legacy-color
 * resolution for Gauge, the reset-to-default link for Bullet) stays in each
 * control since those behaviors genuinely differ.
 */
export const RangeRow = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.sizeUnit * 2}px;
  margin-bottom: ${({ theme }) => theme.sizeUnit}px;
`;

export const RangeLabel = styled.span`
  min-width: 90px;
  color: ${({ theme }) => theme.colorTextSecondary};
  font-size: ${({ theme }) => theme.fontSizeSM}px;
`;

/**
 * Returns a copy of a positional color array with the value at `index`
 * replaced, leaving every other position as reported by `colorAt` (the
 * control's own resolver, which may fall back to a legacy or scheme-derived
 * default rather than the raw `value` prop). Shared because both
 * `IntervalColorsControl` and `BulletRangeColorsControl` build their
 * `onChange` payload this same way.
 */
export function replaceColorAtIndex(
  length: number,
  index: number,
  newValue: string,
  colorAt: (i: number) => string,
): string[] {
  return Array.from({ length }, (_, i) =>
    i === index ? newValue : colorAt(i),
  );
}
