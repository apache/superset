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
import { isRangesInputComplete } from '@superset-ui/plugin-chart-echarts';
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
    if (typeof color !== 'string' || !boundsComplete) return;
    onChange?.(replaceColorAtIndex(bounds.length, index, color, colorAt));
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
              disabled={!boundsComplete}
            />
          </IntervalRow>
        ))
      )}
    </div>
  );
}
