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
import { toEnclosedTimeRange } from './timeRange';

describe('toEnclosedTimeRange', () => {
  // Local time: 2026-09-09 (Wednesday) 10:30:00.
  const now = new Date(2026, 8, 9, 10, 30, 0);

  test('expands "Previous week" to the previous calendar week', () => {
    expect(toEnclosedTimeRange('Previous week', now)).toBe(
      '2026-08-31 00:00:00 : 2026-09-07 00:00:00',
    );
  });

  test('expands "Previous month" to the previous calendar month', () => {
    expect(toEnclosedTimeRange('Previous month', now)).toBe(
      '2026-08-01 00:00:00 : 2026-09-01 00:00:00',
    );
  });

  test('expands "Previous quarter" to the previous calendar quarter', () => {
    expect(toEnclosedTimeRange('Previous quarter', now)).toBe(
      '2026-04-01 00:00:00 : 2026-07-01 00:00:00',
    );
  });

  test('expands "Previous year" to the previous calendar year', () => {
    expect(toEnclosedTimeRange('Previous year', now)).toBe(
      '2025-01-01 00:00:00 : 2026-01-01 00:00:00',
    );
  });

  test('expands "This week" to the current calendar week', () => {
    expect(toEnclosedTimeRange('This week', now)).toBe(
      '2026-09-07 00:00:00 : 2026-09-14 00:00:00',
    );
  });

  test('expands "This month" to the current calendar month', () => {
    expect(toEnclosedTimeRange('This month', now)).toBe(
      '2026-09-01 00:00:00 : 2026-10-01 00:00:00',
    );
  });

  test('expands "This quarter" to the current calendar quarter', () => {
    expect(toEnclosedTimeRange('This quarter', now)).toBe(
      '2026-07-01 00:00:00 : 2026-10-01 00:00:00',
    );
  });

  test('expands "This year" to the current calendar year', () => {
    expect(toEnclosedTimeRange('This year', now)).toBe(
      '2026-01-01 00:00:00 : 2027-01-01 00:00:00',
    );
  });

  test('expands "Today" and "Yesterday" to full days', () => {
    expect(toEnclosedTimeRange('Today', now)).toBe(
      '2026-09-09 00:00:00 : 2026-09-10 00:00:00',
    );
    expect(toEnclosedTimeRange('Yesterday', now)).toBe(
      '2026-09-08 00:00:00 : 2026-09-09 00:00:00',
    );
  });

  test('expands "week to date" to the start of the week until now', () => {
    expect(toEnclosedTimeRange('week to date', now)).toBe(
      '2026-09-07 00:00:00 : 2026-09-09 10:30:00',
    );
  });

  test('expands "month to date" to the start of the month until now', () => {
    expect(toEnclosedTimeRange('month to date', now)).toBe(
      '2026-09-01 00:00:00 : 2026-09-09 10:30:00',
    );
  });

  test('expands "quarter to date" to the start of the quarter until now', () => {
    expect(toEnclosedTimeRange('quarter to date', now)).toBe(
      '2026-07-01 00:00:00 : 2026-09-09 10:30:00',
    );
  });

  test('expands "year to date" to the start of the year until now', () => {
    expect(toEnclosedTimeRange('year to date', now)).toBe(
      '2026-01-01 00:00:00 : 2026-09-09 10:30:00',
    );
  });

  test('expands lowercase "last"/"next" variants', () => {
    expect(toEnclosedTimeRange('last week', now)).toBe(
      '2026-09-02 00:00:00 : 2026-09-09 00:00:00',
    );
    expect(toEnclosedTimeRange('last 12 months', now)).toBe(
      '2025-09-09 00:00:00 : 2026-09-09 00:00:00',
    );
    expect(toEnclosedTimeRange('next 30 days', now)).toBe(
      '2026-09-09 00:00:00 : 2026-10-09 00:00:00',
    );
  });

  test('passes through ranges the backend resolves on its own', () => {
    expect(toEnclosedTimeRange('Last week', now)).toBe('Last week');
    expect(toEnclosedTimeRange('Next 30 days', now)).toBe('Next 30 days');
    expect(toEnclosedTimeRange('Current month', now)).toBe('Current month');
    expect(toEnclosedTimeRange('previous calendar week', now)).toBe(
      'previous calendar week',
    );
  });

  test('passes through already-enclosed ranges', () => {
    expect(toEnclosedTimeRange('2026-01-01 : 2026-12-31', now)).toBe(
      '2026-01-01 : 2026-12-31',
    );
  });

  test('passes through undefined, empty, "No filter" and unknown input', () => {
    expect(toEnclosedTimeRange(undefined, now)).toBeUndefined();
    expect(toEnclosedTimeRange('', now)).toBe('');
    expect(toEnclosedTimeRange('No filter', now)).toBe('No filter');
    expect(toEnclosedTimeRange('some custom range', now)).toBe(
      'some custom range',
    );
  });
});
