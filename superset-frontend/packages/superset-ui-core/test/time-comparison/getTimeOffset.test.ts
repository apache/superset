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
import { getTimeOffset } from '@superset-ui/core';

test('handles custom shifts', () => {
  const shifts = ['custom'];
  const startDate = '2023-01-01';
  const timeRangeFilter = { comparator: '2023-01-03 : 2023-01-10' };

  const result = getTimeOffset(timeRangeFilter, shifts, startDate);
  expect(result).toEqual(['2 days ago']);
});

test('handles inherit shifts', () => {
  const shifts = ['inherit'];
  const startDate = '';
  const timeRangeFilter = { comparator: '2023-01-03 : 2023-01-10' };

  const result = getTimeOffset(timeRangeFilter, shifts, startDate);
  expect(result).toEqual(['7 days ago']);
});

test('handles no custom or inherit shifts', () => {
  const shifts = ['1 week ago'];
  const startDate = '';
  const timeRangeFilter = { comparator: '2023-01-03 : 2023-01-10' };

  const result = getTimeOffset(timeRangeFilter, shifts, startDate);
  expect(result).toEqual(['1 week ago']);
});
