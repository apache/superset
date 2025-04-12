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
import { t } from '@superset-ui/core';
import { Radio } from 'src/components/Radio';
import {
  CURRENT_RANGE_OPTIONS,
  CURRENT_CALENDAR_RANGE_SET,
} from 'src/explore/components/controls/DateFilterControl/utils';
import { CurrentRangeType, CurrentWeek, FrameComponentProps } from '../types';

export function CurrentCalendarFrame({ onChange, value }: FrameComponentProps) {
  useEffect(() => {
    if (!CURRENT_CALENDAR_RANGE_SET.has(value as CurrentRangeType)) {
      onChange(CurrentWeek);
    }
  }, [value]);

  if (!CURRENT_CALENDAR_RANGE_SET.has(value as CurrentRangeType)) {
    return null;
  }

  return (
    <>
      <div className="section-title">
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
        onChange={(e: any) => {
          let newValue = e.target.value;
          newValue = newValue.trim();
          if (newValue === '') return;
          onChange(newValue);
        }}
        options={CURRENT_RANGE_OPTIONS}
      />
    </>
  );
}
