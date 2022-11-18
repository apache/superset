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
import moment from 'moment';
import { t } from '@superset-ui/core';
import {
  SelectOptionType,
  PreviousCalendarWeek,
  PreviousCalendarMonth,
  PreviousCalendarYear,
  CommonRangeType,
  CalendarRangeType,
} from 'src/explore/components/controls/DateFilterControl/types';

export const FRAME_OPTIONS: SelectOptionType[] = [
  { value: 'Common', label: t('Last') },
  { value: 'Calendar', label: t('Previous') },
  { value: 'Custom', label: t('Custom') },
  { value: 'Advanced', label: t('Advanced') },
  { value: 'No filter', label: t('No filter') },
];

export const COMMON_RANGE_OPTIONS: SelectOptionType[] = [
  { value: 'Last day', label: t('last day') },
  { value: 'Last week', label: t('last week') },
  { value: 'Last month', label: t('last month') },
  { value: 'Last quarter', label: t('last quarter') },
  { value: 'Last year', label: t('last year') },
];
export const COMMON_RANGE_VALUES_SET = new Set(
  COMMON_RANGE_OPTIONS.map(({ value }) => value),
);

export const CALENDAR_RANGE_OPTIONS: SelectOptionType[] = [
  { value: PreviousCalendarWeek, label: t('previous calendar week') },
  {
    value: PreviousCalendarMonth,
    label: t('previous calendar month'),
  },
  { value: PreviousCalendarYear, label: t('previous calendar year') },
];
export const CALENDAR_RANGE_VALUES_SET = new Set(
  CALENDAR_RANGE_OPTIONS.map(({ value }) => value),
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

export const COMMON_RANGE_SET: Set<CommonRangeType> = new Set([
  'Last day',
  'Last week',
  'Last month',
  'Last quarter',
  'Last year',
]);

export const CALENDAR_RANGE_SET: Set<CalendarRangeType> = new Set([
  PreviousCalendarWeek,
  PreviousCalendarMonth,
  PreviousCalendarYear,
]);

export const MOMENT_FORMAT = 'YYYY-MM-DD[T]HH:mm:ss';
export const SEVEN_DAYS_AGO = moment()
  .utc()
  .startOf('day')
  .subtract(7, 'days')
  .format(MOMENT_FORMAT);
export const MIDNIGHT = moment().utc().startOf('day').format(MOMENT_FORMAT);

export const LOCALE_MAPPING = {
  en: 'en_US',
  fr: 'fr_FR',
  es: 'es_ES',
  it: 'it_IT',
  zh: 'zh_CN',
  ja: 'ja_JP',
  de: 'de_DE',
  pt: 'pt_PT',
  pt_BR: 'pt_BR',
  ru: 'ru_RU',
  ko: 'ko_KR',
  sk: 'sk_SK',
  sl: 'sl_SI',
  nl: 'nl_NL',
};

export enum DATE_FILTER_TEST_KEY {
  commonFrame = 'common-frame',
  modalOverlay = 'modal-overlay',
  popoverOverlay = 'time-range-trigger',
  noFilter = 'no-filter',
  cancelButton = 'cancel-button',
  applyButton = 'date-filter-control__apply-button',
}
