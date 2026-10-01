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
import { Button } from '@superset-ui/core/components';
import {
  tokenizeToNumericArray,
  isRangesInputComplete,
} from '@superset-ui/plugin-chart-echarts';
import ControlHeader from '../../ControlHeader';
import ColorPickerControl from '../ColorPickerControl';
import type { ColorPickerValue } from '../ColorPickerControl';
import {
  RangeRow,
  RangeLabel,
  replaceColorAtIndex,
} from '../shared/RangeColorRow';
import { BulletRangeColorsControlProps } from './types';

/**
 * Per-range color editor for the Bullet chart. Row *count* is driven by the
 * sibling `ranges` control (one row per parsed threshold) so range values
 * keep a single source of truth; this control only owns colors, stored as
 * an array of hex strings positionally matched to those thresholds. An
 * empty string entry (or a missing entry past the end of the array) means
 * "no custom color" -- `Bullet/transformProps.ts` falls back to the default
 * theme-token band ramp for that range, so existing saved Bullet charts
 * (which have no `range_colors` at all) render identically to before this
 * control existed.
 */
export default function BulletRangeColorsControl({
  value,
  onChange,
  ranges,
  ...headerProps
}: BulletRangeColorsControlProps) {
  const rangeValues = tokenizeToNumericArray(ranges) ?? [];
  // While `ranges` is mid-edit (e.g. "20,,60"), tokenizeToNumericArray's
  // leniency silently compacts it to a shorter list, which would otherwise
  // shift colors to the wrong positions. Block commits until it's complete
  // again so no edit can be positionally misaligned once it is.
  const rangesComplete = isRangesInputComplete(ranges);

  const colorAt = (index: number): string => value?.[index] || '';

  const handleColorChange = (index: number) => (color: ColorPickerValue) => {
    if (typeof color !== 'string' || !rangesComplete) return;
    onChange?.(replaceColorAtIndex(rangeValues.length, index, color, colorAt));
  };

  const handleReset = (index: number) => {
    if (!rangesComplete) return;
    onChange?.(replaceColorAtIndex(rangeValues.length, index, '', colorAt));
  };

  return (
    <div>
      <ControlHeader {...headerProps} />
      {rangeValues.length === 0 ? (
        <RangeLabel>
          {t('Add ranges above to configure their colors here.')}
        </RangeLabel>
      ) : (
        rangeValues.map((range, index) => (
          // eslint-disable-next-line react/no-array-index-key
          <RangeRow key={index}>
            <RangeLabel>
              {t('Up to')} {range}
            </RangeLabel>
            <ColorPickerControl
              ariaLabel={t('Color for range up to %s', range)}
              value={colorAt(index) || undefined}
              onChange={handleColorChange(index)}
              outputFormat="hex"
              disabled={!rangesComplete}
            />
            {colorAt(index) && (
              <Button
                buttonSize="small"
                buttonStyle="link"
                disabled={!rangesComplete}
                onClick={() => handleReset(index)}
              >
                {t('Use default')}
              </Button>
            )}
          </RangeRow>
        ))
      )}
    </div>
  );
}
