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
import { useEffect } from 'react';
import { t } from '@apache-superset/core/translation';
import { Radio } from '@superset-ui/core/components/Radio';
import {
  CURRENT_RANGE_OPTIONS,
  CURRENT_CALENDAR_RANGE_SET,
} from 'src/explore/components/controls/DateFilterControl/utils';
import { defaultPreset, presetGroup, presetOptions } from './limitFields';
import { CurrentRangeType, CurrentWeek, FrameComponentProps } from '../types';

export function CurrentCalendarFrame({
  onChange,
  value,
  limits,
}: FrameComponentProps) {
  const presets = limits?.presets;
  const defaultValue = defaultPreset(
    CURRENT_RANGE_OPTIONS,
    CurrentWeek,
    presets,
  );
  useEffect(() => {
    if (!CURRENT_CALENDAR_RANGE_SET.has(value as CurrentRangeType)) {
      onChange(defaultValue);
    }
  }, [value]);

  if (!CURRENT_CALENDAR_RANGE_SET.has(value as CurrentRangeType)) {
    return null;
  }
  const options = presetOptions(CURRENT_RANGE_OPTIONS, value, presets, limits);
  const group = presetGroup(limits, options);

  return (
    <>
      <div className="section-title" id={group.titleId}>
        {t('Configure Time Range: Current...')}
      </div>
      <Radio.GroupWrapper
        spaceConfig={{
          direction: 'vertical',
          size: 15,
          align: 'start',
          wrap: true,
        }}
        size="large"
        value={value}
        onChange={(e: any) => {
          let newValue = e.target.value;
          newValue = newValue.trim();
          if (newValue === '') return;
          onChange(newValue);
        }}
        options={options}
        {...group.groupProps}
      />
      {group.note}
    </>
  );
}
