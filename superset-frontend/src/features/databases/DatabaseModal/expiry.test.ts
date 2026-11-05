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
import { calendarDaysUntil, isExpiringSoon } from './expiry';

// Noon UTC is 07:00 on Nov 5 under the jest timezone, America/New_York.
beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date('2026-11-05T12:00:00Z'));
});

afterEach(() => {
  jest.useRealTimers();
});

test('a token expiring later the same calendar day is 0 days away and expiring soon', () => {
  expect(calendarDaysUntil('2026-11-05T22:50:00Z')).toBe(0);
  expect(isExpiringSoon('2026-11-05T22:50:00Z')).toBe(true);
});

test('a token 7 calendar days away is expiring soon', () => {
  expect(calendarDaysUntil('2026-11-12T12:00:00Z')).toBe(7);
  expect(isExpiringSoon('2026-11-12T12:00:00Z')).toBe(true);
});

test('a token 8 calendar days away is not expiring soon, even under 8 days of hours', () => {
  // Nov 13 at 00:30 in New York, 7 days and 17.5 hours ahead.
  expect(calendarDaysUntil('2026-11-13T05:30:00Z')).toBe(8);
  expect(isExpiringSoon('2026-11-13T05:30:00Z')).toBe(false);
});

test('a token from a past calendar day counts as expiring soon', () => {
  // The server decides whether it has expired; the browser clock already passed it.
  expect(calendarDaysUntil('2026-11-03T12:00:00Z')).toBe(-2);
  expect(isExpiringSoon('2026-11-03T12:00:00Z')).toBe(true);
});

test('an invalid date counts no days and is not expiring soon', () => {
  expect(calendarDaysUntil('not a date')).toBeNaN();
  expect(isExpiringSoon('not a date')).toBe(false);
});
