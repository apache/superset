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
import dayjs from 'dayjs';
import { guessFrame } from '../utils';
import {
  formatCalendarRange,
  formatCalendarRangeLabel,
  isCalendarRange,
  parseCalendarRange,
  resolvedRangeToCalendar,
} from '../utils/calendarRange';

test('parseCalendarRange parses a valid "start : end" string into dayjs dates, reversing the exclusive-end offset', () => {
  // The stored end (2024-02-01) is the exclusive bound one day past the
  // last included day, so it should display back as 2024-01-31.
  const [start, end] = parseCalendarRange('2024-01-01 : 2024-02-01') ?? [];
  expect(start?.format('YYYY-MM-DD')).toBe('2024-01-01');
  expect(end?.format('YYYY-MM-DD')).toBe('2024-01-31');
});

test('parseCalendarRange returns null for empty or invalid input', () => {
  expect(parseCalendarRange(undefined)).toBeNull();
  expect(parseCalendarRange(null)).toBeNull();
  expect(parseCalendarRange('not a range')).toBeNull();
});

test('parseCalendarRange returns null for a single date with no separator', () => {
  // dayjs(undefined) resolves to "now", which is valid — a missing end
  // date must be rejected explicitly rather than relying on that quirk.
  expect(parseCalendarRange('2024-01-01')).toBeNull();
});

test('formatCalendarRange advances the end date by one day so the selected end day is included (upper bound is exclusive)', () => {
  const range = formatCalendarRange([dayjs('2024-01-01'), dayjs('2024-01-31')]);
  expect(range).toBe('2024-01-01 : 2024-02-01');
});

test('formatCalendarRange covers a single selected day when start and end are the same date', () => {
  const range = formatCalendarRange([dayjs('2024-01-15'), dayjs('2024-01-15')]);
  expect(range).toBe('2024-01-15 : 2024-01-16');
});

test('formatCalendarRange returns undefined when either date is missing', () => {
  expect(formatCalendarRange(null)).toBeUndefined();
  expect(formatCalendarRange([dayjs('2024-01-01'), null])).toBeUndefined();
});

test('formatCalendarRange and parseCalendarRange round-trip back to the original selected dates', () => {
  const original: [dayjs.Dayjs, dayjs.Dayjs] = [
    dayjs('2024-03-05'),
    dayjs('2024-03-20'),
  ];
  const stored = formatCalendarRange(original);
  const [start, end] = parseCalendarRange(stored) ?? [];
  expect(start?.format('YYYY-MM-DD')).toBe('2024-03-05');
  expect(end?.format('YYYY-MM-DD')).toBe('2024-03-20');
});

test('formatCalendarRangeLabel shows the picked days with the end day included', () => {
  expect(formatCalendarRangeLabel('2026-11-01 : 2026-12-01')).toBe(
    '2026-11-01 – 2026-11-30',
  );
  expect(formatCalendarRangeLabel('Last week')).toBeUndefined();
});

test('isCalendarRange only accepts a fixed whole-day "start : end" range', () => {
  expect(isCalendarRange('2024-01-01 : 2024-02-01')).toBe(true);
  expect(isCalendarRange('Last week')).toBe(false);
  expect(isCalendarRange('2024-01-01T09:30:00 : 2024-02-01')).toBe(false);
  expect(isCalendarRange(undefined)).toBe(false);
});

test('resolvedRangeToCalendar shows a midnight upper bound as the previous day', () => {
  const { range, hasTimeOfDay } = resolvedRangeToCalendar(
    '2024-01-01T00:00:00',
    '2024-01-08T00:00:00',
  );
  expect(range?.[0]?.format('YYYY-MM-DD')).toBe('2024-01-01');
  expect(range?.[1]?.format('YYYY-MM-DD')).toBe('2024-01-07');
  expect(hasTimeOfDay).toBe(false);
});

test('resolvedRangeToCalendar flags a bound that carries a time of day', () => {
  const { range, hasTimeOfDay } = resolvedRangeToCalendar(
    '2024-01-01T09:30:00',
    '2024-01-08T09:30:00',
  );
  expect(range?.[0]?.format('YYYY-MM-DD')).toBe('2024-01-01');
  expect(range?.[1]?.format('YYYY-MM-DD')).toBe('2024-01-08');
  expect(hasTimeOfDay).toBe(true);
});

test('resolvedRangeToCalendar returns no range for an open-ended or empty bound', () => {
  expect(resolvedRangeToCalendar('', '2024-01-08T00:00:00').range).toBeNull();
  expect(resolvedRangeToCalendar(null, null).range).toBeNull();
});

test('guessFrame opens a fixed whole-day range in the Calendar frame, and leaves other values alone', () => {
  expect(guessFrame('2024-01-01 : 2024-02-01')).toBe('DateRange');
  expect(guessFrame('Last week')).toBe('Common');
  expect(guessFrame('Last week : tomorrow')).toBe('Advanced');
  expect(guessFrame('2021-03-16T00:00:00 : 2021-03-17T00:00:00')).toBe(
    'Custom',
  );
});
