/*
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

import { parseMilliseconds } from '@superset-ui/core/number-format/utils/parseMilliseconds';

test('parseMilliseconds should parse basic time units correctly', () => {
  expect(parseMilliseconds(500)).toEqual({
    years: 0,
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
    milliseconds: 500,
    microseconds: 0,
    nanoseconds: 0,
  });
  expect(parseMilliseconds(5000)).toEqual({
    years: 0,
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 5,
    milliseconds: 0,
    microseconds: 0,
    nanoseconds: 0,
  });
  expect(parseMilliseconds(120000)).toEqual({
    years: 0,
    days: 0,
    hours: 0,
    minutes: 2,
    seconds: 0,
    milliseconds: 0,
    microseconds: 0,
    nanoseconds: 0,
  });
  expect(parseMilliseconds(7200000)).toEqual({
    years: 0,
    days: 0,
    hours: 2,
    minutes: 0,
    seconds: 0,
    milliseconds: 0,
    microseconds: 0,
    nanoseconds: 0,
  });
  expect(parseMilliseconds(172800000)).toEqual({
    years: 0,
    days: 2,
    hours: 0,
    minutes: 0,
    seconds: 0,
    milliseconds: 0,
    microseconds: 0,
    nanoseconds: 0,
  });
  expect(parseMilliseconds(31536000000)).toEqual({
    years: 1,
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
    milliseconds: 0,
    microseconds: 0,
    nanoseconds: 0,
  });
});

test('parseMilliseconds should handle complex duration', () => {
  expect(parseMilliseconds(90061234)).toEqual({
    years: 0,
    days: 1,
    hours: 1,
    minutes: 1,
    seconds: 1,
    milliseconds: 234,
    microseconds: 0,
    nanoseconds: 0,
  });
});

test('parseMilliseconds should handle fractional milliseconds', () => {
  expect(parseMilliseconds(1.001001)).toEqual({
    years: 0,
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
    milliseconds: 1,
    microseconds: 1,
    nanoseconds: 1,
  });
});

test('parseMilliseconds should handle zero', () => {
  expect(parseMilliseconds(0)).toEqual({
    years: 0,
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
    milliseconds: 0,
    microseconds: 0,
    nanoseconds: 0,
  });
});
