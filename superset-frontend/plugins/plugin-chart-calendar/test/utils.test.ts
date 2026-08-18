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

import { getFormattedUTCTime, convertUTCTimestampToLocal } from '../src/utils';

test('getFormattedUTCTime formats local timestamp for display as UTC date', () => {
  const utcTimestamp = 1420070400000; // 2015-01-01 00:00:00 UTC
  const localTimestamp = convertUTCTimestampToLocal(utcTimestamp);
  // Cal-Heatmap's afterLoadData adjusts timestamps similarly, so
  // getFormattedUTCTime receives already-adjusted timestamps and
  // formats them directly. The date component should be correct.
  const formattedTime = getFormattedUTCTime(localTimestamp, '%Y-%m-%d');

  expect(formattedTime).toEqual('2015-01-01');
});

test('convertUTCTimestampToLocal adjusts timestamp so local Date shows UTC date', () => {
  const utcTimestamp = 1704067200000;
  const adjustedTimestamp = convertUTCTimestampToLocal(utcTimestamp);
  const adjustedDate = new Date(adjustedTimestamp);

  expect(adjustedDate.getFullYear()).toEqual(2024);
  expect(adjustedDate.getMonth()).toEqual(0);
  expect(adjustedDate.getDate()).toEqual(1);
});

test('convertUTCTimestampToLocal handles month boundaries', () => {
  const utcTimestamp = 1706745600000;
  const adjustedDate = new Date(convertUTCTimestampToLocal(utcTimestamp));

  expect(adjustedDate.getFullYear()).toEqual(2024);
  expect(adjustedDate.getMonth()).toEqual(1);
  expect(adjustedDate.getDate()).toEqual(1);
});

test('convertUTCTimestampToLocal handles year boundaries', () => {
  const utcTimestamp = 1735689600000;
  const adjustedDate = new Date(convertUTCTimestampToLocal(utcTimestamp));

  expect(adjustedDate.getFullYear()).toEqual(2025);
  expect(adjustedDate.getMonth()).toEqual(0);
  expect(adjustedDate.getDate()).toEqual(1);
});

test('convertUTCTimestampToLocal adds timezone offset to timestamp', () => {
  const utcTimestamp = 1704067200000;
  const adjustedTimestamp = convertUTCTimestampToLocal(utcTimestamp);
  const expectedOffset = new Date(utcTimestamp).getTimezoneOffset() * 60 * 1000;

  expect(adjustedTimestamp - utcTimestamp).toEqual(expectedOffset);
});

test('convertUTCTimestampToLocal fixes timezone bug for CalHeatMap', () => {
  const febFirst2024UTC = 1706745600000;
  const adjustedDate = new Date(convertUTCTimestampToLocal(febFirst2024UTC));

  expect(adjustedDate.getMonth()).toEqual(1);
  expect(adjustedDate.getDate()).toEqual(1);
});

test('convertUTCTimestampToLocal and getFormattedUTCTime work together to display dates correctly', () => {
  const utcTimestamp = 1704067200000;

  // convertUTCTimestampToLocal adjusts UTC for Cal-Heatmap (which interprets as local)
  const localTimestamp = convertUTCTimestampToLocal(utcTimestamp);
  const calHeatmapDate = new Date(localTimestamp);
  expect(calHeatmapDate.getMonth()).toEqual(0);
  expect(calHeatmapDate.getDate()).toEqual(1);

  // getFormattedUTCTime receives LOCAL timestamp (from Cal-Heatmap) and formats it
  const formattedTime = getFormattedUTCTime(localTimestamp, '%Y-%m-%d');
  expect(formattedTime).toContain('2024-01-01');
});
