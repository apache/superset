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

test('getSmartDateFormatter preserves minutes for MINUTE grain', () => {
  const formatter = getSmartDateFormatter(TimeGranularity.MINUTE);
  const date1 = new Date('2024-01-15T10:35:00Z');
  const date2 = new Date('2024-01-15T10:00:00Z');
  expect(formatter(date1)).not.toBe(formatter(date2));
});

test('getSmartDateFormatter preserves minutes for FIFTEEN_MINUTES grain', () => {
  const formatter = getSmartDateFormatter(TimeGranularity.FIFTEEN_MINUTES);
  const date1 = new Date('2024-01-15T10:15:00Z');
  const date2 = new Date('2024-01-15T10:30:00Z');
  expect(formatter(date1)).not.toBe(formatter(date2));
});

test('getSmartDateFormatter collapses to hour for HOUR grain', () => {
  const formatter = getSmartDateFormatter(TimeGranularity.HOUR);
  const date1 = new Date('2024-01-15T10:00:00Z');
  const date2 = new Date('2024-01-15T10:30:00Z');
  expect(formatter(date1)).toBe(formatter(date2));
});
