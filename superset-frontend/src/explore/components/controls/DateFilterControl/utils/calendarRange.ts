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
import { extendedDayjs } from '@superset-ui/core/utils/dates';

export const DATE_FORMAT = 'YYYY-MM-DD';
export const RANGE_SEPARATOR = ' : ';

export type DateRangeValue = [Dayjs | null, Dayjs | null] | null;

/**
 * The start and (exclusive) end of a "YYYY-MM-DD : YYYY-MM-DD" range, only when both
 * are real calendar dates (strict parsing, so "2026-02-31" is rejected rather than
 * rolled over to March) and the start is before the end.
 */
function parseStrictRange(value?: string | null): [Dayjs, Dayjs] | null {
  if (!value) return null;
  const parts = value.split(RANGE_SEPARATOR);
  if (parts.length !== 2) return null;
  const start = extendedDayjs(parts[0], DATE_FORMAT, true);
  const end = extendedDayjs(parts[1], DATE_FORMAT, true);
  if (!start.isValid() || !end.isValid() || !start.isBefore(end)) return null;
  return [start, end];
}

// Superset's time_range filter treats the upper bound as exclusive
// (`col < end_dttm`, see superset/models/helpers.py get_time_filter), so the
// stored end date is the day AFTER the one the user picked — otherwise the
// entire selected end day would be excluded from query results. Displaying
// it back to the user reverses that offset so round-tripping stays exact.
export function parseCalendarRange(value?: string | null): DateRangeValue {
  const range = parseStrictRange(value);
  if (!range) return null;
  const [start, end] = range;
  return [start, end.subtract(1, 'day')];
}

export function formatCalendarRange(dates: DateRangeValue): string | undefined {
  const [start, end] = dates ?? [null, null];
  if (!start || !end) return undefined;
  const exclusiveEnd = end.add(1, 'day');
  return `${start.format(DATE_FORMAT)}${RANGE_SEPARATOR}${exclusiveEnd.format(DATE_FORMAT)}`;
}

/** The range as the user picked it, with the end day included: "2026-11-01 – 2026-11-30". */
export function formatCalendarRangeLabel(
  value?: string | null,
): string | undefined {
  const [start, end] = parseCalendarRange(value) ?? [null, null];
  if (!start || !end) return undefined;
  return `${start.format(DATE_FORMAT)} – ${end.format(DATE_FORMAT)}`;
}

/** True for a fixed, whole-day range as produced by the calendar picker. */
export const isCalendarRange = (value?: string | null): boolean =>
  parseStrictRange(value) !== null;

/**
 * Turns the since/until the backend resolves for any time range expression
 * (e.g. "Last week") into the dates the calendar shows. `until` is exclusive,
 * so a midnight bound is shown as the previous day. A bound that carries a
 * time of day cannot be shown as whole days, so it is flagged.
 */
export function resolvedRangeToCalendar(
  since?: string | null,
  until?: string | null,
): { range: DateRangeValue; hasTimeOfDay: boolean } {
  if (!since || !until) return { range: null, hasTimeOfDay: false };
  const start = dayjs(since);
  const end = dayjs(until);
  if (!start.isValid() || !end.isValid()) {
    return { range: null, hasTimeOfDay: false };
  }
  const endsAtMidnight = end.isSame(end.startOf('day'));
  return {
    range: [start, endsAtMidnight ? end.subtract(1, 'day') : end],
    hasTimeOfDay: !start.isSame(start.startOf('day')) || !endsAtMidnight,
  };
}
