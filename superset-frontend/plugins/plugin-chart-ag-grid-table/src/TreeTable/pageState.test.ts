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
import { normalizePage, normalizePageSize, pageLimit } from './pageState';

test.each([10, 20, 50, 100, 200])('accepts page size %s', size => {
  expect(normalizePageSize(size, 50)).toBe(size);
  expect(normalizePageSize(undefined, size)).toBe(size);
});
test.each([7, 33, 'x', -1, NaN, undefined])(
  'normalizes invalid size %s and page',
  value => {
    expect(normalizePageSize(value, 33)).toBe(50);
    expect(normalizePageSize(value, 100)).toBe(100);
    expect(normalizePage(value, 50, 100)).toBe(
      typeof value === 'number' && Number.isInteger(value) && value >= 0
        ? 1
        : 0,
    );
  },
);
test.each([
  [3, 50, 120, 2, 20],
  [2, 50, 100, 1, 50],
  [99, 50, 120, 2, 20],
  [3, 200, 120, 0, 120],
  [3, 50, 10, 0, 10],
  [2, 20, 0, 2, 20],
])(
  'clamps page %s at size %s and cap %s',
  (page, size, cap, expectedPage, limit) => {
    const normalized = normalizePage(page, size, cap);
    expect(normalized).toBe(expectedPage);
    expect(pageLimit(normalized, size, cap)).toEqual({
      row_offset: expectedPage * size,
      row_limit: limit,
    });
    expect(pageLimit(normalized, size, cap).row_limit).toBeGreaterThan(0);
  },
);
test.each([2.5, -1, NaN, 'x', undefined])(
  'invalid page %s starts at zero',
  page => expect(normalizePage(page, 50, 120)).toBe(0),
);
