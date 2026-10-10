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

import { parseToNumber } from './numberUtils';

test('should handle numeric values', () => {
  expect(parseToNumber(123)).toBe(123);
  expect(parseToNumber(45.67)).toBe(45.67);
  expect(parseToNumber(0)).toBe(0);
  expect(parseToNumber(-123)).toBe(-123);
});

test('should handle string values', () => {
  expect(parseToNumber('123')).toBe(123);
  expect(parseToNumber('45.67')).toBe(45.67);
  expect(parseToNumber('0')).toBe(0);
  expect(parseToNumber('-123')).toBe(-123);
});

test('should handle null and undefined values', () => {
  expect(parseToNumber(null)).toBe(0);
  expect(parseToNumber(undefined)).toBe(0);
});

test('should handle invalid string values', () => {
  expect(parseToNumber('not a number')).toBe(0);
  expect(parseToNumber('abc123')).toBe(0);
  expect(parseToNumber('')).toBe(0);
});
