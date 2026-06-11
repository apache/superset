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
import isBlank from './isBlank';

test('returns true for null', () => {
  expect(isBlank(null)).toBe(true);
});

test('returns true for undefined', () => {
  expect(isBlank(undefined)).toBe(true);
});

test('returns true for empty string', () => {
  expect(isBlank('')).toBe(true);
});

test('returns true for whitespace-only strings', () => {
  expect(isBlank(' ')).toBe(true);
  expect(isBlank('  ')).toBe(true);
  expect(isBlank('\t')).toBe(true);
  expect(isBlank('\n')).toBe(true);
  expect(isBlank(' \t\n ')).toBe(true);
});

test('returns false for non-empty strings', () => {
  expect(isBlank('hello')).toBe(false);
  expect(isBlank(' hello ')).toBe(false);
});

test('returns true for NaN', () => {
  expect(isBlank(NaN)).toBe(true);
});

test('returns false for numbers', () => {
  expect(isBlank(0)).toBe(false);
  expect(isBlank(50)).toBe(false);
  expect(isBlank(-1)).toBe(false);
});

test('returns false for booleans', () => {
  expect(isBlank(true)).toBe(false);
  expect(isBlank(false)).toBe(false);
});
