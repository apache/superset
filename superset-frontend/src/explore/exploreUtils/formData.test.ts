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
import { sanitizeFormData, isEqualish } from './formData';

test('sanitizeFormData removes temporary control values', () => {
  expect(
    sanitizeFormData({
      url_params: { foo: 'bar' },
      metrics: ['foo', 'bar'],
    }),
  ).toEqual({ metrics: ['foo', 'bar'] });
});

test('isEqualish', () => {
  // considers null, undefined, {} and [] as equal
  expect(isEqualish(null, undefined)).toBe(true);
  expect(isEqualish(null, [])).toBe(true);
  expect(isEqualish(null, {})).toBe(true);
  expect(isEqualish(undefined, {})).toBe(true);

  // considers empty strings are the same as null
  expect(isEqualish(undefined, '')).toBe(true);
  expect(isEqualish(null, '')).toBe(true);

  // considers deeply equal objects as equal
  expect(isEqualish('', '')).toBe(true);
  expect(isEqualish({ a: 1, b: 2, c: 3 }, { a: 1, b: 2, c: 3 })).toBe(true);

  // Out of order
  expect(isEqualish({ a: 1, b: 2, c: 3 }, { b: 2, a: 1, c: 3 })).toBe(true);

  // Actually  not equal
  expect(isEqualish({ a: 1, b: 2, z: 9 }, { a: 1, b: 2, c: 3 })).toBe(false);
});
