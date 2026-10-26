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
import { getCategoricalSchemeRegistry } from '@superset-ui/core';
import {
  isRangesInputComplete,
  hasTrailingBlankToken,
} from '@superset-ui/plugin-chart-echarts';
import ControlHeader from '../../ControlHeader';
import ColorPickerControl from '../ColorPickerControl';
import type { ColorPickerValue } from '../ColorPickerControl';
import {
  RangeRow as IntervalRow,
  RangeLabel as BoundLabel,
  replaceColorAtIndex,
} from '../shared/RangeColorRow';
import { IntervalColorsControlProps } from './types';
import {
  parseIntervalBounds as parseBounds,
  resolveLegacyIntervalColors as resolveLegacyColors,
} from './legacyColors';

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
  // `parseBounds` leniently drops blank tokens (e.g. mid-edit "20,,60"),
  // which would otherwise shift colors to the wrong bound once the blank is
  // filled back in -- same hazard `BulletRangeColorsControl` guards against.
  const boundsComplete = isRangesInputComplete(intervals);
  // Once `interval_colors` is populated the renderer ignores the legacy
  // indices and falls back to the scheme's positional color for any missing
  // entry, so the display must do the same to avoid persisting a different
  // color into an untouched band.
  const hasExplicitColors = Array.isArray(value) && value.length > 0;
  // See the identical guard in `BulletRangeColorsControl`: while `intervals`
  // ends in the one tolerated trailing blank (the last bound is being
  // retyped), `bounds` is transiently one entry short. Writing a color at
  // that moment must not truncate the array to that shorter length, or the
  // color for the bound being retyped is permanently lost. For a legacy
  // chart with no explicit colors yet, the legacy indices are the only
  // record of how many bands there were, so they set that floor too;
  // otherwise the first color edit in this window would persist a shorter
  // explicit array, and the bound being retyped would come back with the
  // positional scheme color instead of its legacy one.
  const legacyIndexCount = legacyIntervalColorIndices?.trim()
    ? legacyIntervalColorIndices.split(',').length
    : 0;
  const writeLength = hasTrailingBlankToken(intervals)
    ? Math.max(
        bounds.length,
        value?.length ?? 0,
        hasExplicitColors ? 0 : legacyIndexCount,
      )
    : bounds.length;
  const legacyColors = resolveLegacyColors(
    writeLength,
    legacyIntervalColorIndices,
    colorScheme,
  );
  const schemeColors =
    getCategoricalSchemeRegistry().get(colorScheme)?.colors ?? [];
  // Legacy indices past the static palette resolve only against the
  // renderer's render-time palette, so the editor cannot show (or safely
  // persist) the colors the chart renders. Stay read-only until explicit
  // colors exist, so a row edit never rewrites an untouched band.
  const legacyUnresolved =
    !hasExplicitColors &&
    legacyIndexCount > 0 &&
    legacyColors.length > 0 &&
    legacyColors.every(color => color === '');
  const editable = boundsComplete && !legacyUnresolved;
  const colorAt = (index: number): string =>
    value?.[index] ||
    (hasExplicitColors ? '' : legacyColors[index]) ||
    schemeColors[index % (schemeColors.length || 1)] ||
    '';

  const handleColorChange = (index: number) => (color: ColorPickerValue) => {
    if (typeof color !== 'string' || !editable) return;
    onChange?.(replaceColorAtIndex(writeLength, index, color, colorAt));
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
            <BoundLabel>{t('Up to %s', bound)}</BoundLabel>
            <ColorPickerControl
              ariaLabel={t('Color for interval up to %s', bound)}
              value={colorAt(index)}
              onChange={handleColorChange(index)}
              outputFormat="hex"
              disabled={!editable}
            />
          </IntervalRow>
        ))
      )}
    </div>
  );
}
