/*
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

import { NumberFormatter, createLengthFormatter } from '@superset-ui/core';

test('creates an instance of NumberFormatter with default id and label', () => {
  const formatter = createLengthFormatter();
  expect(formatter).toBeInstanceOf(NumberFormatter);
  expect(formatter.id).toBe('length_format');
  expect(formatter.label).toBe('Length formatter');
});

test('passes the value through unconverted without a convertType', () => {
  const formatter = createLengthFormatter();
  expect(formatter(0)).toBe('0');
  expect(formatter(1234)).toBe('1234');
  expect(formatter(-56.7)).toBe('-56.7');
});

test('converts meters to kilometers', () => {
  const formatter = createLengthFormatter({ convertType: 'm => km' });
  expect(formatter(1000)).toBe('1.00km');
  expect(formatter(1500)).toBe('1.50km');
  expect(formatter(0)).toBe('0.00km');
  expect(formatter(-2500)).toBe('-2.50km');
});

test('converts centimeters to kilometers', () => {
  const formatter = createLengthFormatter({ convertType: 'cm => km' });
  expect(formatter(100_000)).toBe('1.00km');
  expect(formatter(250_000)).toBe('2.50km');
  expect(formatter(1234)).toBe('0.01km');
});

test('converts centimeters to meters', () => {
  const formatter = createLengthFormatter({ convertType: 'cm => m' });
  expect(formatter(100)).toBe('1.00m');
  expect(formatter(42)).toBe('0.42m');
  expect(formatter(-300)).toBe('-3.00m');
});

test('honors custom id, label, and description', () => {
  const formatter = createLengthFormatter({
    id: 'my_length',
    label: 'My length',
    description: 'Converts lengths',
    convertType: 'm => km',
  });
  expect(formatter.id).toBe('my_length');
  expect(formatter.label).toBe('My length');
  expect(formatter.description).toBe('Converts lengths');
});
