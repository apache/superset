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

import { isValidJalaaliDate, toGregorian, toJalaali } from 'jalaali-js';

export interface PersianDateParts {
  year: number;
  month: number;
  day: number;
  monthName: string;
  weekday: string;
}

export interface GregorianDateParts {
  year: number;
  month: number;
  day: number;
}

// Persian calendar months
export const PERSIAN_MONTHS = [
  'فروردین',
  'اردیبهشت',
  'خرداد',
  'تیر',
  'مرداد',
  'شهریور',
  'مهر',
  'آبان',
  'آذر',
  'دی',
  'بهمن',
  'اسفند',
];

// Persian calendar days
export const PERSIAN_WEEKDAYS = [
  'شنبه',
  'یکشنبه',
  'دوشنبه',
  'سه‌شنبه',
  'چهارشنبه',
  'پنج‌شنبه',
  'جمعه',
];

const getWeekdayName = (year: number, month: number, day: number) =>
  PERSIAN_WEEKDAYS[new Date(year, month - 1, day).getDay()];

// Convert Gregorian date to Persian date (accurate Jalali conversion)
export function gregorianToPersian(
  year: number,
  month: number,
  day: number,
): PersianDateParts {
  const { jy, jm, jd } = toJalaali(year, month, day);

  return {
    year: jy,
    month: jm,
    day: jd,
    monthName: PERSIAN_MONTHS[jm - 1],
    weekday: getWeekdayName(year, month, day),
  };
}

// Convert Persian date to Gregorian date (accurate Jalali conversion)
export function persianToGregorian(
  year: number,
  month: number,
  day: number,
): GregorianDateParts {
  if (!isValidJalaaliDate(year, month, day)) {
    throw new Error('Invalid Jalali date');
  }

  const { gy, gm, gd } = toGregorian(year, month, day);
  return {
    year: gy,
    month: gm,
    day: gd,
  };
}

export function formatPersianDate(
  year: number,
  month: number,
  day: number,
): string {
  const monthStr = month.toString().padStart(2, '0');
  const dayStr = day.toString().padStart(2, '0');
  return `${year}/${monthStr}/${dayStr}`;
}

export function getCurrentPersianDate(): PersianDateParts {
  const now = new Date();
  return gregorianToPersian(
    now.getFullYear(),
    now.getMonth() + 1,
    now.getDate(),
  );
}

export function isValidPersianDate(
  year: number,
  month: number,
  day: number,
): boolean {
  return isValidJalaaliDate(year, month, day);
}
