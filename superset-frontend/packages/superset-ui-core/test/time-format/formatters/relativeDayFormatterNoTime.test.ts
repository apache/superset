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

import { createRelativeDayFormatterNoTime } from '@superset-ui/core';

test('createRelativeDayFormatterNoTime returns a formatter', () => {
  const formatter = createRelativeDayFormatterNoTime();
  expect(formatter).toBeDefined();
  expect(typeof formatter.format).toBe('function');
});

test('formats Day 1 correctly (01/01/2000 00:00 UTC)', () => {
  const formatter = createRelativeDayFormatterNoTime();
  const date = new Date(Date.UTC(2000, 0, 1, 0, 0, 0, 0));
  expect(formatter(date)).toBe('Day 1');
});

test('formats Day 4 without time (04/01/2000 18:30 UTC)', () => {
  const formatter = createRelativeDayFormatterNoTime();
  const date = new Date(Date.UTC(2000, 0, 4, 18, 30, 0, 0));
  expect(formatter(date)).toBe('Day 4');
});

test('formats Day -1 correctly (31/12/1999 11:15 UTC)', () => {
  const formatter = createRelativeDayFormatterNoTime();
  const date = new Date(Date.UTC(1999, 11, 31, 11, 15, 0, 0));
  expect(formatter(date)).toBe('Day -1');
});

test('formats Day -4 correctly (28/12/1999 11:15 UTC)', () => {
  const formatter = createRelativeDayFormatterNoTime();
  const date = new Date(Date.UTC(1999, 11, 28, 11, 15, 0, 0));
  expect(formatter(date)).toBe('Day -4');
});

test('formats Day 2 without time (02/01/2000 00:00 UTC)', () => {
  const formatter = createRelativeDayFormatterNoTime();
  const date = new Date(Date.UTC(2000, 0, 2, 0, 0, 0, 0));
  expect(formatter(date)).toBe('Day 2');
});

test('ignores time component (01/01/2000 12:00 UTC)', () => {
  const formatter = createRelativeDayFormatterNoTime();
  const date = new Date(Date.UTC(2000, 0, 1, 12, 0, 0, 0));
  expect(formatter(date)).toBe('Day 1');
});

test('ignores time component (01/01/2000 14:05 UTC)', () => {
  const formatter = createRelativeDayFormatterNoTime();
  const date = new Date(Date.UTC(2000, 0, 1, 14, 5, 0, 0));
  expect(formatter(date)).toBe('Day 1');
});

test('handles timestamp numbers as input', () => {
  const formatter = createRelativeDayFormatterNoTime();
  const timestamp = Date.UTC(2000, 0, 4, 18, 30, 0, 0);
  expect(formatter(timestamp)).toBe('Day 4');
});
