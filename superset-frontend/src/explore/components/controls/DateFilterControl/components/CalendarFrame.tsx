// DODO was here
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
            {/* DODO changed */}
            {t(label)}
          </Radio>
        ))}
      </Radio.Group>
    </>
  );
}
