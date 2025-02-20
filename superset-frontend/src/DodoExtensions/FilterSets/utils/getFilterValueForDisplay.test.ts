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
import { getFilterValueForDisplay } from '.';

test('Should return "" when value is null or undefined', () => {
  expect(getFilterValueForDisplay(null)).toBe('');
  expect(getFilterValueForDisplay(undefined)).toBe('');
  expect(getFilterValueForDisplay()).toBe('');
});

test('Should return "string value" when value is string or number', () => {
  expect(getFilterValueForDisplay(123)).toBe('123');
  expect(getFilterValueForDisplay('123')).toBe('123');
});

test('Should return a string with values ​​separated by commas', () => {
  expect(getFilterValueForDisplay(['a', 'b', 'c'])).toBe('a, b, c');
});

test('Should return a JSON.stringify from objects', () => {
  expect(getFilterValueForDisplay({ any: 'value' })).toBe('{"any":"value"}');
});

test('Should return an error message when the type is invalid', () => {
  expect(getFilterValueForDisplay(true as any)).toBe('Unknown value');
});
