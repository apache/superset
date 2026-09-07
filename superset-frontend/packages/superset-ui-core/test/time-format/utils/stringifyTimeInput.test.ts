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
import stringifyTimeInput from '../../../src/time-format/utils/stringifyTimeInput';

const format = (time: Date) => time.toISOString();

test('returns the stringified value for null and undefined', () => {
  expect(stringifyTimeInput(null, format)).toBe('null');
  expect(stringifyTimeInput(undefined, format)).toBe('undefined');
});

test('formats Date and numeric inputs', () => {
  const date = new Date(Date.UTC(2017, 1, 14, 11, 22, 33));
  expect(stringifyTimeInput(date, format)).toBe('2017-02-14T11:22:33.000Z');
  expect(stringifyTimeInput(date.getTime(), format)).toBe(
    '2017-02-14T11:22:33.000Z',
  );
});

test('treats an integer string as a timestamp in milliseconds', () => {
  expect(stringifyTimeInput('1487071353000', format)).toBe(
    '2017-02-14T11:22:33.000Z',
  );
});

test('formats a parseable timestamp string', () => {
  expect(stringifyTimeInput('2017-02-14T11:22:33Z', format)).toBe(
    '2017-02-14T11:22:33.000Z',
  );
});

test('returns unparseable strings unchanged instead of formatting an Invalid Date', () => {
  // Duration values such as these are not timestamps. Formatting them used to
  // render as "NaN:NaN:NaN" in the Table chart.
  expect(stringifyTimeInput('00:01:54', format)).toBe('00:01:54');
  expect(stringifyTimeInput('0 days 00:01:54', format)).toBe('0 days 00:01:54');
  expect(stringifyTimeInput('not a date', format)).toBe('not a date');
});

test('returns the representation of a Date that could not be resolved', () => {
  expect(stringifyTimeInput(new Date('00:01:54'), format)).toBe('Invalid Date');
});
