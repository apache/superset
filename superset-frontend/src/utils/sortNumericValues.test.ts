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
import sortNumericValues from './sortNumericValues';

test('should always sort null and NaNs to bottom', () => {
  expect([null, 1, 2, '1', '5', NaN].sort(sortNumericValues)).toEqual([
    1,
    '1',
    2,
    '5',
    NaN,
    null,
  ]);
  expect(
    [null, 1, 2, '1', '5', NaN].sort((a, b) =>
      sortNumericValues(a, b, { descending: true }),
    ),
  ).toEqual(['5', 2, 1, '1', NaN, null]);
});

test('should treat null and NaN as smallest numbers', () => {
  expect(
    [null, 1, 2, '1', '5', NaN].sort((a, b) =>
      sortNumericValues(a, b, { nanTreatment: 'asSmallest' }),
    ),
  ).toEqual([null, NaN, 1, '1', 2, '5']);
  expect(
    [null, 1, 2, '1', '5', NaN].sort((a, b) =>
      sortNumericValues(a, b, { nanTreatment: 'asSmallest', descending: true }),
    ),
  ).toEqual(['5', 2, 1, '1', NaN, null]);
});

test('should treat null and NaN as largest numbers', () => {
  expect(
    [null, 1, 2, '1', '5', NaN].sort((a, b) =>
      sortNumericValues(a, b, { nanTreatment: 'asLargest' }),
    ),
  ).toEqual([1, '1', 2, '5', NaN, null]);
  expect(
    [null, 1, 2, '1', '5', NaN].sort((a, b) =>
      sortNumericValues(a, b, { nanTreatment: 'asLargest', descending: true }),
    ),
  ).toEqual([null, NaN, '5', 2, 1, '1']);
});
