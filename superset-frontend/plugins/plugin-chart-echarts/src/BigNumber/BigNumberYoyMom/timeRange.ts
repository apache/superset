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
/**
 * Expands open-ended time range strings into fully-enclosed
 * "start : end" timestamps so the backend's Time Comparison validation
 * (superset/models/helpers.py) accepts the query.
 *
 * The backend (superset/utils/date_parser.py) already resolves "Last ...",
 * "Next ...", "Current ..." and "previous calendar ..." ranges into enclosed
 * bounds on its own, so those are passed through untouched. Ranges such as
 * "Previous week", "This month", "Yesterday" or "month to date" resolve to an
 * open-ended range (only an "until" bound) on the backend, which fails the
 * enclosed-range check that is required whenever a time comparison
 * (time_offsets) is present. Those are expanded here using the same calendar
 * semantics the backend applies to their capitalized counterparts.
 */

const DATE_SEPARATOR = ' : ';

// Ranges the backend resolves to enclosed bounds on its own.
const BACKEND_ENCLOSED =
  /^(Last|Next|Current)( \d+)? (second|minute|hour|day|week|month|quarter|year)s?$|^previous calendar (week|month|quarter|year)$/;

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;

const pad = (n: number): string => String(n).padStart(2, '0');

const formatDateTime = (d: Date): string =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;

const truncateToDay = (d: Date): Date =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate());

const startOfIsoWeek = (d: Date): Date => {
  const day = truncateToDay(d);
  const offset = (day.getDay() + 6) % 7; // Monday = 0
  return new Date(day.getFullYear(), day.getMonth(), day.getDate() - offset);
};

const addMonths = (d: Date, months: number): Date =>
  new Date(d.getFullYear(), d.getMonth() + months, d.getDate());

const startOfQuarter = (d: Date): Date =>
  new Date(d.getFullYear(), Math.floor(d.getMonth() / 3) * 3, 1);

const startOfYear = (d: Date): Date => new Date(d.getFullYear(), 0, 1);

const shiftUnits = (d: Date, amount: number, unit: string): Date => {
  switch (unit) {
    case 'second':
      return new Date(d.getTime() + amount * SECOND);
    case 'minute':
      return new Date(d.getTime() + amount * MINUTE);
    case 'hour':
      return new Date(d.getTime() + amount * HOUR);
    case 'day':
      return new Date(d.getTime() + amount * DAY);
    case 'week':
      return new Date(d.getTime() + amount * WEEK);
    case 'month':
      return addMonths(d, amount);
    case 'quarter':
      return addMonths(d, amount * 3);
    case 'year':
      return new Date(d.getFullYear() + amount, d.getMonth(), d.getDate());
    default:
      return d;
  }
};

export const toEnclosedTimeRange = (
  timeRange: string | undefined,
  now: Date = new Date(),
): string | undefined => {
  if (!timeRange || timeRange === 'No filter') {
    return timeRange;
  }
  if (timeRange.includes(DATE_SEPARATOR)) {
    return timeRange;
  }
  if (BACKEND_ENCLOSED.test(timeRange)) {
    return timeRange;
  }

  const enclosed = (since: Date, until: Date): string =>
    `${formatDateTime(since)}${DATE_SEPARATOR}${formatDateTime(until)}`;

  const normalized = timeRange.trim().toLowerCase();
  const today = truncateToDay(now);
  const startWeek = startOfIsoWeek(now);
  const startMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startQuarter = startOfQuarter(now);
  const startYear = startOfYear(now);

  const expanded: [Date, Date] | undefined = (() => {
    switch (normalized) {
      case 'yesterday':
        return [new Date(today.getTime() - DAY), today];
      case 'today':
        return [today, new Date(today.getTime() + DAY)];
      case 'previous week':
        return [new Date(startWeek.getTime() - WEEK), startWeek];
      case 'previous month':
        return [addMonths(startMonth, -1), startMonth];
      case 'previous quarter':
        return [addMonths(startQuarter, -3), startQuarter];
      case 'previous year':
        return [new Date(startYear.getFullYear() - 1, 0, 1), startYear];
      case 'this week':
        return [startWeek, new Date(startWeek.getTime() + WEEK)];
      case 'this month':
        return [startMonth, addMonths(startMonth, 1)];
      case 'this quarter':
        return [startQuarter, addMonths(startQuarter, 3)];
      case 'this year':
        return [startYear, new Date(startYear.getFullYear() + 1, 0, 1)];
      case 'week to date':
        return [startWeek, now];
      case 'month to date':
        return [startMonth, now];
      case 'quarter to date':
        return [startQuarter, now];
      case 'year to date':
        return [startYear, now];
      default:
        return undefined;
    }
  })();
  if (expanded) {
    return enclosed(expanded[0], expanded[1]);
  }

  // Lowercase "last"/"next" variants (the backend only recognizes the
  // capitalized forms): expand them with the same semantics the backend
  // applies to their capitalized counterparts.
  const relativeMatch = normalized.match(
    /^(last|next) (\d+)? ?(second|minute|hour|day|week|month|quarter|year)s?$/,
  );
  if (relativeMatch) {
    const [, direction, rawAmount, unit] = relativeMatch;
    const amount = rawAmount ? parseInt(rawAmount, 10) : 1;
    const sign = direction === 'last' ? -1 : 1;
    // Align with the backend: day and coarser granularity truncates to the
    // start of the day, finer granularity keeps the current time.
    const base = ['second', 'minute', 'hour'].includes(unit) ? now : today;
    const shifted = shiftUnits(base, sign * amount, unit);
    return direction === 'last'
      ? enclosed(shifted, base)
      : enclosed(base, shifted);
  }

  return timeRange;
};
