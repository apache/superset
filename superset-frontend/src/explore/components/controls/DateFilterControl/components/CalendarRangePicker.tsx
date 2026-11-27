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
import { useEffect, useState } from 'react';
import rison from 'rison';
import { NO_TIME_RANGE, SupersetClient } from '@superset-ui/core';
import { t } from '@apache-superset/core/translation';
import { RangePicker, Tooltip } from '@superset-ui/core/components';
import {
  DATE_FORMAT,
  DateRangeValue,
  formatCalendarRange,
  isCalendarRange,
  parseCalendarRange,
  resolvedRangeToCalendar,
} from '../utils/calendarRange';

export interface CalendarRangePickerProps {
  /** A time range: a fixed "start : end" range, an expression, or NO_TIME_RANGE. */
  value?: string;
  onChange: (timeRange: string) => void;
  onOpenChange?: (open: boolean) => void;
  status?: 'error' | 'warning';
  getPopupContainer?: () => HTMLElement;
}

interface CalendarValue {
  range: DateRangeValue;
  hasTimeOfDay: boolean;
}

const EMPTY: CalendarValue = { range: null, hasTimeOfDay: false };

// Shows any time range as dates. Fixed ranges are read directly; expressions
// such as "Last week" are resolved by the backend, so the picker can show the
// dates a default value actually covers.
function useCalendarValue(value?: string): CalendarValue {
  const [resolved, setResolved] = useState<CalendarValue>(EMPTY);
  const isFixed = isCalendarRange(value);
  const isEmpty = !value || value === NO_TIME_RANGE;

  useEffect(() => {
    if (isFixed || isEmpty) {
      setResolved(EMPTY);
      return undefined;
    }
    let cancelled = false;
    SupersetClient.get({
      endpoint: `/api/v1/time_range/?q=${rison.encode_uri(value)}`,
    })
      .then(({ json }) => {
        if (!cancelled) {
          setResolved(
            resolvedRangeToCalendar(
              json?.result?.[0]?.since,
              json?.result?.[0]?.until,
            ),
          );
        }
      })
      .catch(() => {
        if (!cancelled) setResolved(EMPTY);
      });
    return () => {
      cancelled = true;
    };
  }, [value, isFixed, isEmpty]);

  if (isFixed) {
    return { range: parseCalendarRange(value), hasTimeOfDay: false };
  }
  return isEmpty ? EMPTY : resolved;
}

/**
 * A plain calendar for choosing a date range. Picking dates produces a fixed
 * range that includes the chosen end date; clearing it means no filter.
 */
export function CalendarRangePicker({
  value,
  onChange,
  onOpenChange,
  status,
  getPopupContainer,
}: CalendarRangePickerProps) {
  const { range, hasTimeOfDay } = useCalendarValue(value);

  const picker = (
    <RangePicker
      value={range}
      format={DATE_FORMAT}
      allowClear
      style={{ width: '100%' }}
      status={hasTimeOfDay && !status ? 'warning' : status}
      onOpenChange={onOpenChange}
      getPopupContainer={getPopupContainer}
      onChange={dates => onChange(formatCalendarRange(dates) ?? NO_TIME_RANGE)}
    />
  );

  return hasTimeOfDay ? (
    <Tooltip
      title={t(
        'This range includes a time of day, so it is not made of whole days. Pick dates to use whole days.',
      )}
    >
      {picker}
    </Tooltip>
  ) : (
    picker
  );
}
