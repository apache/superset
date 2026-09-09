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
import { dttmToDayjs } from 'src/explore/components/controls/DateFilterControl/utils/dateParser';

// jest.config.js pins TZ to America/New_York (UTC-4 in June) for all unit
// tests, giving these assertions a fixed, non-zero UTC offset to catch
// UTC/local mix-ups against.

afterEach(() => {
  jest.useRealTimers();
});

test('dttmToDayjs("now") resolves to the current local time, not UTC', () => {
  jest.useFakeTimers();
  // Midnight UTC on June 3rd is 8pm the previous day in America/New_York
  // (UTC-4 during summer time).
  jest.setSystemTime(new Date('2024-06-03T00:00:00Z'));

  const result = dttmToDayjs('now');

  // dttmToDayjs's fallback branch (`extendedDayjs(dttm)`) re-parses a naive
  // "YYYY-MM-DDTHH:mm:ss" string -- the format produced when "now" gets
  // resolved and formatted elsewhere in this module -- as local wall-clock
  // time. For that round trip to reproduce the actual current moment,
  // resolving "now" must also use local wall-clock time rather than UTC.
  expect(result.format('YYYY-MM-DD HH:mm:ss')).toEqual('2024-06-02 20:00:00');
});

test('dttmToDayjs("today") resolves to local midnight, not UTC midnight', () => {
  jest.useFakeTimers();
  // 2am UTC on June 3rd is still June 2nd, 10pm, in America/New_York.
  jest.setSystemTime(new Date('2024-06-03T02:00:00Z'));

  const result = dttmToDayjs('today');

  expect(result.format('YYYY-MM-DD HH:mm:ss')).toEqual('2024-06-02 00:00:00');
});
