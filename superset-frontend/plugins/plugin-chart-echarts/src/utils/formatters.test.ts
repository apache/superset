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

import { TimeGranularity } from '@superset-ui/core';
import { getSmartDateFormatter } from './formatters';

test('getSmartDateFormatter returns a formatter for MINUTE grain', () => {
  const formatter = getSmartDateFormatter(TimeGranularity.MINUTE);
  // Verify formatter is defined and callable
  expect(formatter).toBeDefined();
  const date = new Date('2024-01-15T10:35:00Z');
  expect(() => formatter(date)).not.toThrow();
});

test('getSmartDateFormatter returns a formatter for FIFTEEN_MINUTES grain', () => {
  const formatter = getSmartDateFormatter(TimeGranularity.FIFTEEN_MINUTES);
  expect(formatter).toBeDefined();
  const date = new Date('2024-01-15T10:15:00Z');
  expect(() => formatter(date)).not.toThrow();
});

test('getSmartDateFormatter returns a formatter for HOUR grain', () => {
  const formatter = getSmartDateFormatter(TimeGranularity.HOUR);
  expect(formatter).toBeDefined();
  const date = new Date('2024-01-15T10:00:00Z');
  expect(() => formatter(date)).not.toThrow();
});

test('getSmartDateFormatter returns a formatter for SECOND grain', () => {
  const formatter = getSmartDateFormatter(TimeGranularity.SECOND);
  expect(formatter).toBeDefined();
  const date = new Date('2024-01-15T10:35:45Z');
  expect(() => formatter(date)).not.toThrow();
});

test('getSmartDateFormatter returns base formatter when no grain provided', () => {
  const formatter = getSmartDateFormatter();
  expect(formatter).toBeDefined();
});
