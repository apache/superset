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

import type { LabeledValue as AntdLabeledValue } from 'antd/es/select';
import { DEFAULT_SORT_COMPARATOR } from './constants';

test('DEFAULT_SORT_COMPARATOR sorts by label text when both labels are strings', () => {
  const a = { value: 'b', label: 'banana' } as AntdLabeledValue;
  const b = { value: 'a', label: 'apple' } as AntdLabeledValue;
  expect(DEFAULT_SORT_COMPARATOR(a, b)).toBeGreaterThan(0);
  expect(DEFAULT_SORT_COMPARATOR(b, a)).toBeLessThan(0);
});

test('DEFAULT_SORT_COMPARATOR sorts by value text when labels are not strings', () => {
  const a = { value: 'b' } as AntdLabeledValue;
  const b = { value: 'a' } as AntdLabeledValue;
  expect(DEFAULT_SORT_COMPARATOR(a, b)).toBeGreaterThan(0);
  expect(DEFAULT_SORT_COMPARATOR(b, a)).toBeLessThan(0);
});

test('DEFAULT_SORT_COMPARATOR returns numeric difference when values are numbers', () => {
  const a = { value: 3 } as unknown as AntdLabeledValue;
  const b = { value: 1 } as unknown as AntdLabeledValue;
  expect(DEFAULT_SORT_COMPARATOR(a, b)).toBe(2);
  expect(DEFAULT_SORT_COMPARATOR(b, a)).toBe(-2);
});

test('DEFAULT_SORT_COMPARATOR uses rankedSearchCompare when search is provided', () => {
  const a = { value: 'abc', label: 'abc' } as AntdLabeledValue;
  const b = { value: 'bc', label: 'bc' } as AntdLabeledValue;
  // 'bc' is an exact match to search 'bc', so it should sort first (lower index = negative diff)
  expect(DEFAULT_SORT_COMPARATOR(a, b, 'bc')).toBeGreaterThan(0);
});
