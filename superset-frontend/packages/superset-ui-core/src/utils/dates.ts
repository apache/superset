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

import dayjs, { Dayjs } from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import calendar from 'dayjs/plugin/calendar';
import relativeTime from 'dayjs/plugin/relativeTime';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import duration from 'dayjs/plugin/duration';
import updateLocale from 'dayjs/plugin/updateLocale';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(calendar);
dayjs.extend(relativeTime);
dayjs.extend(customParseFormat);
dayjs.extend(duration);
dayjs.extend(updateLocale);
dayjs.extend(isSameOrBefore);

dayjs.updateLocale('en', {
  invalidDate: 'Invalid date',
});

export const extendedDayjs = dayjs;

export const fDuration = function (
  t1: number,
  t2: number,
  format = 'HH:mm:ss.SSS',
): string {
  const diffSec = t2 - t1;
  const duration = dayjs(new Date(diffSec));
  return duration.utc().format(format);
};

export const now = function (): number {
  // seconds from EPOCH as a float
  return dayjs().utc().valueOf();
};

export const epochTimeXHoursAgo = function (h: number): number {
  return dayjs().subtract(h, 'hours').utc().valueOf();
};

export const epochTimeXDaysAgo = function (d: number): number {
  return dayjs().subtract(d, 'days').utc().valueOf();
};

export const epochTimeXYearsAgo = function (y: number): number {
  return dayjs().subtract(y, 'years').utc().valueOf();
};

export const isDST = function (date: Dayjs, timezoneName: string): boolean {
  const standardOffset = dayjs.tz('2021-01-01', timezoneName).utcOffset();
  const currentOffset = date.tz(timezoneName).utcOffset();
  return currentOffset !== standardOffset;
};
