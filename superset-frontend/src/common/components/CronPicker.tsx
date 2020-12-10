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
import React from 'react';
import { styled, t } from '@superset-ui/core';
import ReactCronPicker, { Locale, CronProps } from 'react-js-cron';

export * from 'react-js-cron';

export const LOCALE: Locale = {
  everyText: t('every'),
  emptyMonths: t('every month'),
  emptyMonthDays: t('every day of the month'),
  emptyMonthDaysShort: t('day of the month'),
  emptyWeekDays: t('every day of the week'),
  emptyWeekDaysShort: t('day of the week'),
  emptyHours: t('every hour'),
  emptyMinutes: t('every minute UTC'),
  emptyMinutesForHourPeriod: t('every'),
  yearOption: t('year'),
  monthOption: t('month'),
  weekOption: t('week'),
  dayOption: t('day'),
  hourOption: t('hour'),
  minuteOption: t('minute'),
  rebootOption: t('reboot'),
  prefixPeriod: t('Every'),
  prefixMonths: t('in'),
  prefixMonthDays: t('on'),
  prefixWeekDays: t('on'),
  prefixWeekDaysForMonthAndYearPeriod: t('and'),
  prefixHours: t('at'),
  prefixMinutes: t(':'),
  prefixMinutesForHourPeriod: t('at'),
  suffixMinutesForHourPeriod: t('minute(s) UTC'),
  errorInvalidCron: t('Invalid cron expression'),
  clearButtonText: t('Clear'),
  weekDays: [
    // Order is important, the index will be used as value
    t('Sunday'), // Sunday must always be first, it's "0"
    t('Monday'),
    t('Tuesday'),
    t('Wednesday'),
    t('Thursday'),
    t('Friday'),
    t('Saturday'),
  ],
  months: [
    // Order is important, the index will be used as value
    t('January'),
    t('February'),
    t('March'),
    t('April'),
    t('May'),
    t('June'),
    t('July'),
    t('August'),
    t('September'),
    t('October'),
    t('November'),
    t('December'),
  ],
  // Order is important, the index will be used as value
  altWeekDays: [
    t('SUN'), // Sunday must always be first, it's "0"
    t('MON'),
    t('TUE'),
    t('WED'),
    t('THU'),
    t('FRI'),
    t('SAT'),
  ],
  // Order is important, the index will be used as value
  altMonths: [
    t('JAN'),
    t('FEB'),
    t('MAR'),
    t('APR'),
    t('MAY'),
    t('JUN'),
    t('JUL'),
    t('AUG'),
    t('SEP'),
    t('OCT'),
    t('NOV'),
    t('DEC'),
  ],
};

export const CronPicker = styled((props: CronProps) => (
  <ReactCronPicker locale={LOCALE} {...props} />
))`
  .react-js-cron-select:not(.react-js-cron-custom-select) > div:first-of-type,
  .react-js-cron-custom-select {
    border-radius: ${({ theme }) => theme.gridUnit}px;
    background-color: ${({ theme }) =>
      theme.colors.grayscale.light4} !important;
  }
  .react-js-cron-custom-select > div:first-of-type {
    border-radius: ${({ theme }) => theme.gridUnit}px;
  }
`;
