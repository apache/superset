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
import { formatTimeRange, parseTimeRange } from './utils';

test('parseTimeRange parses a valid "start : end" string into dayjs dates', () => {
  const [start, end] = parseTimeRange('2024-01-01 : 2024-01-31') ?? [];
  expect(start?.format('YYYY-MM-DD')).toBe('2024-01-01');
  expect(end?.format('YYYY-MM-DD')).toBe('2024-01-31');
});

test('parseTimeRange returns null for empty or invalid input', () => {
  expect(parseTimeRange(undefined)).toBeNull();
  expect(parseTimeRange(null)).toBeNull();
  expect(parseTimeRange('not a range')).toBeNull();
});

test('parseTimeRange returns null for a single date with no separator', () => {
  // dayjs(undefined) resolves to "now", which is valid — a missing end
  // date must be rejected explicitly rather than relying on that quirk.
  expect(parseTimeRange('2024-01-01')).toBeNull();
});

test('formatTimeRange formats a date pair as "start : end" with no time-of-day', () => {
  const range = formatTimeRange([dayjs('2024-01-01'), dayjs('2024-01-31')]);
  expect(range).toBe('2024-01-01 : 2024-01-31');
});

test('formatTimeRange returns undefined when either date is missing', () => {
  expect(formatTimeRange(null)).toBeUndefined();
  expect(formatTimeRange([dayjs('2024-01-01'), null])).toBeUndefined();
});
