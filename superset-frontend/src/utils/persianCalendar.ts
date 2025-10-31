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
  'شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنج‌شنبه', 'جمعه'
];

// Convert Gregorian date to Persian date
export function gregorianToPersian(year: number, month: number, day: number): {
  year: number;
  month: number;
  day: number;
  monthName: string;
  weekday: string;
} {
  // Simple conversion algorithm (approximate)
  const gregorianDate = new Date(year, month - 1, day);
  let persianYear = year - 621;
  
  // Calculate Persian month and day (simplified)
  let persianMonth = month;
  let persianDay = day;
  
  // Adjust for Persian calendar differences
  if (month <= 3) {
    persianYear -= 1;
  }
  
  // Simple month adjustment
  if (month <= 3) {
    persianMonth = month + 9;
  } else {
    persianMonth = month - 3;
  }
  
  // Simple day adjustment
  if (day <= 21) {
    persianDay = day + 10;
  } else {
    persianDay = day - 21;
    persianMonth += 1;
  }
  
  // Handle month overflow
  if (persianMonth > 12) {
    persianMonth -= 12;
    persianYear += 1;
  }
  
  const monthName = PERSIAN_MONTHS[persianMonth - 1];
  const weekday = PERSIAN_WEEKDAYS[gregorianDate.getDay()];
  
  return {
    year: persianYear,
    month: persianMonth,
    day: persianDay,
    monthName,
    weekday
  };
}

// Convert Persian date to Gregorian date
export function persianToGregorian(year: number, month: number, day: number): {
  year: number;
  month: number;
  day: number;
} {
  // Simple conversion algorithm (approximate)
  let gregorianYear = year + 621;
  
  // Calculate Gregorian month and day (simplified)
  let gregorianMonth = month;
  let gregorianDay = day;
  
  // Adjust for Gregorian calendar differences
  if (month <= 9) {
    gregorianYear -= 1;
  }
  
  // Simple month adjustment
  if (month <= 9) {
    gregorianMonth = month + 3;
  } else {
    gregorianMonth = month - 9;
  }
  
  // Simple day adjustment
  if (day <= 10) {
    gregorianDay = day + 21;
  } else {
    gregorianDay = day - 10;
    gregorianMonth += 1;
  }
  
  // Handle month overflow
  if (gregorianMonth > 12) {
    gregorianMonth -= 12;
    gregorianYear += 1;
  }
  
  return {
    year: gregorianYear,
    month: gregorianMonth,
    day: gregorianDay
  };
}

// Format Persian date
export function formatPersianDate(year: number, month: number, day: number): string {
  const monthStr = month.toString().padStart(2, '0');
  const dayStr = day.toString().padStart(2, '0');
  return `${year}/${monthStr}/${dayStr}`;
}

// Get current Persian date
export function getCurrentPersianDate(): {
  year: number;
  month: number;
  day: number;
  monthName: string;
  weekday: string;
} {
  const now = new Date();
  return gregorianToPersian(
    now.getFullYear(),
    now.getMonth() + 1,
    now.getDate()
  );
}