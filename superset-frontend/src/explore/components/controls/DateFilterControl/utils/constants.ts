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
import {
  SelectOptionType,
  PreviousCalendarWeek,
  PreviousCalendarMonth,
  PreviousCalendarQuarter,
  PreviousCalendarYear,
  CalendarRangeType,
  CurrentRangeType,
  CurrentWeek,
  CurrentMonth,
  CurrentYear,
  CurrentQuarter,
  CurrentDay,
} from 'src/explore/components/controls/DateFilterControl/types';
import { CheckboxOptionType } from '@superset-ui/core/components/Radio';
import { extendedDayjs } from '@superset-ui/core/utils/dates';

export const FRAME_OPTIONS: SelectOptionType[] = [
  { value: 'Common', label: t('Last') },
  { value: 'Calendar', label: t('Previous') },
  { value: 'Current', label: t('Current') },
  { value: 'Custom', label: t('Custom') },
  { value: 'Advanced', label: t('Advanced') },
  { value: 'No filter', label: t('No filter') },
];

export const COMMON_RANGE_OPTIONS: CheckboxOptionType[] = [
  { value: 'Last 5 minutes', label: t('Last 5 minutes') },
  { value: 'Last 15 minutes', label: t('Last 15 minutes') },
  { value: 'Last 30 minutes', label: t('Last 30 minutes') },
  { value: 'Last 1 hour', label: t('Last 1 hour') },
  { value: 'Last day', label: t('Last day') },
  { value: 'Last week', label: t('Last week') },
  { value: 'Last month', label: t('Last month') },
  { value: 'Last quarter', label: t('Last quarter') },
  { value: 'Last year', label: t('Last year') },
];
/**
 * Matches any "Last <N> <unit>(s)" time range string.
 * Mirrors the backend regex in superset/utils/date_parser.py, so arbitrary
 * values like "Last 4 hours" or "Last 24 hours" are recognised without
 * needing to enumerate every possibility in a hardcoded list.
 */
export const COMMON_RANGE_REGEX =
  /^[Ll]ast\s+(\d+\s+)?(second|minute|hour|day|week|month|quarter|year)s?$/

export const CALENDAR_RANGE_OPTIONS: CheckboxOptionType[] = [
  { value: PreviousCalendarWeek, label: t('previous calendar week') },
  { value: PreviousCalendarMonth, label: t('previous calendar month') },
  { value: PreviousCalendarQuarter, label: t('previous calendar quarter') },
  { value: PreviousCalendarYear, label: t('previous calendar year') },
];
export const CALENDAR_RANGE_VALUES_SET = new Set(
  CALENDAR_RANGE_OPTIONS.map(value => value.value),
);

export const CURRENT_RANGE_OPTIONS: CheckboxOptionType[] = [
  { value: CurrentDay, label: t('Current day') },
  { value: CurrentWeek, label: t('Current week') },
  { value: CurrentMonth, label: t('Current month') },
  { value: CurrentQuarter, label: t('Current quarter') },
  { value: CurrentYear, label: t('Current year') },
];
export const CURRENT_RANGE_VALUES_SET = new Set(
  CURRENT_RANGE_OPTIONS.map(value => value.value),
);

const GRAIN_OPTIONS = [
  { value: 'second', label: (rel: string) => t('Seconds %s', rel) },
  { value: 'minute', label: (rel: string) => t('Minutes %s', rel) },
  { value: 'hour', label: (rel: string) => t('Hours %s', rel) },
  { value: 'day', label: (rel: string) => t('Days %s', rel) },
  { value: 'week', label: (rel: string) => t('Weeks %s', rel) },
  { value: 'month', label: (rel: string) => t('Months %s', rel) },
  { value: 'quarter', label: (rel: string) => t('Quarters %s', rel) },
  { value: 'year', label: (rel: string) => t('Years %s', rel) },
];

export const SINCE_GRAIN_OPTIONS: SelectOptionType[] = GRAIN_OPTIONS.map(
  item => ({
    value: item.value,
    label: item.label(t('Before')),
  }),
);

export const UNTIL_GRAIN_OPTIONS: SelectOptionType[] = GRAIN_OPTIONS.map(
  item => ({
    value: item.value,
    label: item.label(t('After')),
  }),
);

export const SINCE_MODE_OPTIONS: SelectOptionType[] = [
  { value: 'specific', label: t('Specific Date/Time') },
  { value: 'relative', label: t('Relative Date/Time') },
  { value: 'now', label: t('Now') },
  { value: 'today', label: t('Midnight') },
];

export const UNTIL_MODE_OPTIONS: SelectOptionType[] =
  SINCE_MODE_OPTIONS.slice();

/** @deprecated Use {@link COMMON_RANGE_REGEX} for open-ended pattern matching. */
export const COMMON_RANGE_SET: Set<string> = new Set(
  COMMON_RANGE_OPTIONS.map(option => option.value),
);

export const CALENDAR_RANGE_SET: Set<CalendarRangeType> = new Set([
  PreviousCalendarWeek,
  PreviousCalendarMonth,
  PreviousCalendarQuarter,
  PreviousCalendarYear,
]);

export const CURRENT_CALENDAR_RANGE_SET: Set<CurrentRangeType> = new Set([
  CurrentDay,
  CurrentWeek,
  CurrentMonth,
  CurrentQuarter,
  CurrentYear,
]);

export const DAYJS_FORMAT = 'YYYY-MM-DD[T]HH:mm:ss';
export const SEVEN_DAYS_AGO = extendedDayjs()
  .utc()
  .startOf('day')
  .subtract(7, 'days')
  .format(DAYJS_FORMAT);
export const MIDNIGHT = extendedDayjs()
  .utc()
  .startOf('day')
  .format(DAYJS_FORMAT);

export enum DateFilterTestKey {
  CommonFrame = 'common-frame',
  ModalOverlay = 'modal-overlay',
  PopoverOverlay = 'time-range-trigger',
  NoFilter = 'no-filter',
  CancelButton = 'cancel-button',
  ApplyButton = 'date-filter-control__apply-button',
}
