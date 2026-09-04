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
import isEqualArray from './isEqualArray';

test('isEqualArray', () => {
  expect(isEqualArray([], [])).toBe(true);
  expect(isEqualArray([1, 2], [1, 2])).toBe(true);
  const item1 = { a: 1 };
  expect(isEqualArray([item1], [item1])).toBe(true);
  expect(isEqualArray(null, undefined)).toBe(true);
  // compare is shallow
  expect(isEqualArray([{ a: 1 }], [{ a: 1 }])).toBe(false);
  expect(isEqualArray(null, [])).toBe(false);
  expect(isEqualArray([1, 2], [])).toBe(false);
});
