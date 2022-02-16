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
import React, { useEffect } from 'react';
import { t } from '@superset-ui/core';
import { Radio } from 'src/components/Radio';
import {
  CALENDAR_RANGE_OPTIONS,
  CALENDAR_RANGE_SET,
} from 'src/explore/components/controls/DateFilterControl/utils';
import {
  CalendarRangeType,
  PreviousCalendarWeek,
  FrameComponentProps,
} from '../types';

export function CalendarFrame({ onChange, value }: FrameComponentProps) {
  useEffect(() => {
    if (!CALENDAR_RANGE_SET.has(value as CalendarRangeType)) {
      onChange(PreviousCalendarWeek);
    }
  }, [onChange, value]);

  if (!CALENDAR_RANGE_SET.has(value as CalendarRangeType)) {
    return null;
  }

  return (
    <>
      <div className="section-title">
        {t('Configure Time Range: Previous...')}
      </div>
      <Radio.Group
        value={value}
        onChange={(e: any) => onChange(e.target.value)}
      >
        {CALENDAR_RANGE_OPTIONS.map(({ value, label }) => (
          <Radio key={value} value={value} className="vertical-radio">
            {label}
          </Radio>
        ))}
      </Radio.Group>
    </>
  );
}
