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

import moment from 'moment-timezone';
// Local fallback for URL param reading to avoid dependency and logs
function getUrlParam(param: { name: string } | string): string | null {
  try {
    const key = typeof param === 'string' ? param : param.name;
    const url = new URL(window.location.href);
    return url.searchParams.get(key);
  } catch (_e) {
    return null;
  }
}
const URL_PARAMS = { timezone: { name: 'timezone' } } as const;

const DEFAULT_TIMEZONE = 'Asia/Kolkata';
const DEFAULT_DATE_FORMAT = 'YYYY-MM-DD';
const DEFAULT_DATETIME_FORMAT = 'YYYY-MM-DD HH:mm:ss';

/**
 * Get the target timezone for the application:
 * 1. URL parameter timezone (highest priority)
 * 2. Default to Asia/Kolkata (if no URL param)
 *
 * This is the timezone that ALL dates will be converted TO for display.
 * Browser timezone is just the source - we convert FROM browser TO this target timezone.
 */
export function getCurrentTimezone(): string {
  const urlTimezone = getUrlParam(URL_PARAMS.timezone);
  if (typeof urlTimezone === 'string' && moment.tz.zone(urlTimezone)) {
    return urlTimezone;
  }
  return DEFAULT_TIMEZONE;
}

/**
 * Format a date in the current timezone
 */
export function formatDate(
  date: moment.MomentInput,
  format = DEFAULT_DATE_FORMAT,
  timezone?: string,
): string {
  const tz = timezone || getCurrentTimezone();
  return moment.tz(date, tz).format(format);
}

/**
 * Format a datetime in the current timezone
 */
export function formatDateTime(
  date: moment.MomentInput,
  format = DEFAULT_DATETIME_FORMAT,
  timezone?: string,
): string {
  const tz = timezone || getCurrentTimezone();
  return moment.tz(date, tz).format(format);
}

/**
 * Create a moment object in the current timezone
 */
export function createMomentInTimezone(
  date: moment.MomentInput,
  timezone?: string,
): moment.Moment {
  const tz = timezone || getCurrentTimezone();
  return moment.tz(date, tz);
}

/**
 * Parse a date string and convert it to the current timezone
 */
export function parseAndConvertToTimezone(
  dateString: string,
  inputFormat?: string,
  timezone?: string,
): moment.Moment {
  const tz = timezone || getCurrentTimezone();
  if (inputFormat) {
    return moment.tz(dateString, inputFormat, tz);
  }
  return moment.tz(dateString, tz);
}

/**
 * Get timezone display name for UI
 */
export function getTimezoneDisplayName(timezone?: string): string {
  const tz = timezone || getCurrentTimezone();
  const offset = moment.tz(tz).format('Z');
  return `${tz} (UTC${offset})`;
}

/**
 * Check if a timezone is valid
 */
export function isValidTimezone(timezone: string): boolean {
  return !!moment.tz.zone(timezone);
}

/**
 * Convert a date from the current timezone to UTC for API calls
 */
export function convertToUTC(
  date: moment.MomentInput,
  sourceTimezone?: string,
): moment.Moment {
  const tz = sourceTimezone || getCurrentTimezone();
  return moment.tz(date, tz).utc();
}

/**
 * Convert a UTC date to the current timezone for display
 */
export function convertFromUTC(
  utcDate: moment.MomentInput,
  targetTimezone?: string,
): moment.Moment {
  const tz = targetTimezone || getCurrentTimezone();
  return moment.utc(utcDate).tz(tz);
}

/**
 * Format a UTC date string for API calls
 */
export function formatForAPI(
  date: moment.MomentInput,
  sourceTimezone?: string,
): string {
  return convertToUTC(date, sourceTimezone).toISOString();
}

/**
 * Parse a UTC date from API and format for display
 */
export function formatFromAPI(
  utcDateString: string,
  format = DEFAULT_DATETIME_FORMAT,
  targetTimezone?: string,
): string {
  return convertFromUTC(utcDateString, targetTimezone).format(format);
}
