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
import { t } from '@apache-superset/core/translation';
import { styled } from '@apache-superset/core/theme';
import { getCategoricalSchemeRegistry } from '@superset-ui/core';
import ControlHeader from '../../ControlHeader';
import ColorPickerControl from '../ColorPickerControl';
import type { ColorPickerValue } from '../ColorPickerControl';
import { IntervalColorsControlProps } from './types';

const IntervalRow = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.sizeUnit * 2}px;
  margin-bottom: ${({ theme }) => theme.sizeUnit}px;
`;

const BoundLabel = styled.span`
  min-width: 90px;
  color: ${({ theme }) => theme.colorTextSecondary};
  font-size: ${({ theme }) => theme.fontSizeSM}px;
`;

const parseBounds = (intervals?: string): number[] =>
  (intervals ?? '')
    .split(',')
    .map(part => part.trim())
    .filter(part => part !== '')
    .map(Number)
    .filter(bound => Number.isFinite(bound));

/**
 * Resolves the legacy `interval_color_indices` control (comma-separated,
 * 1-indexed positions into the chosen categorical color scheme) into real
 * hex colors, positionally matched to `bounds`. This exists purely so the
 * control panel shows sensible colors the first time an admin opens a Gauge
 * chart that was saved before `interval_colors` existed -- it doesn't
 * persist anything on its own. Chart rendering for charts that are *never*
 * reopened for editing is handled independently by the equivalent fallback
 * in `Gauge/transformProps.ts`'s `getIntervalBoundsAndColors`.
 */
const resolveLegacyColors = (
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

/**
 * Per-interval color editor for the Gauge chart. Row *count* is driven by
 * the sibling `intervals` control (one row per parsed upper bound) so bound
 * values keep a single source of truth; this control only owns colors,
 * stored as an array of hex strings positionally matched to those bounds.
 */
export default function IntervalColorsControl({
  value,
  onChange,
  intervals,
  legacyIntervalColorIndices,
  colorScheme,
  ...headerProps
}: IntervalColorsControlProps) {
  const bounds = parseBounds(intervals);
  const legacyColors = resolveLegacyColors(
    bounds,
    legacyIntervalColorIndices,
    colorScheme,
  );
  const schemeColors =
    getCategoricalSchemeRegistry().get(colorScheme)?.colors ?? [];

  const colorAt = (index: number): string =>
    value?.[index] ||
    legacyColors[index] ||
    schemeColors[index % (schemeColors.length || 1)] ||
    '';

  const handleColorChange = (index: number) => (color: ColorPickerValue) => {
    if (typeof color !== 'string') return;
    const next = bounds.map((_, i) => (i === index ? color : colorAt(i)));
    onChange?.(next);
  };

  return (
    <div>
      <ControlHeader {...headerProps} />
      {bounds.length === 0 ? (
        <BoundLabel>
          {t('Add interval bounds above to configure colors here.')}
        </BoundLabel>
      ) : (
        bounds.map((bound, index) => (
          // eslint-disable-next-line react/no-array-index-key
          <IntervalRow key={index}>
            <BoundLabel>
              {t('Up to')} {bound}
            </BoundLabel>
            <ColorPickerControl
              ariaLabel={t('Color for interval up to %s', bound)}
              value={colorAt(index)}
              onChange={handleColorChange(index)}
              outputFormat="hex"
            />
          </IntervalRow>
        ))
      )}
    </div>
  );
}
