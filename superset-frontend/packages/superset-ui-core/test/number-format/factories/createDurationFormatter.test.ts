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

import { NumberFormatter, createDurationFormatter } from '@superset-ui/core';

test('creates an instance of NumberFormatter', () => {
  const formatter = createDurationFormatter();
  expect(formatter).toBeInstanceOf(NumberFormatter);
});
test('format milliseconds in human readable format with default options', () => {
  const formatter = createDurationFormatter();
  expect(formatter(-1000)).toBe('-1s');
  expect(formatter(0)).toBe('0ms');
  expect(formatter(1000)).toBe('1s');
  expect(formatter(1337)).toBe('1.3s');
  expect(formatter(10500)).toBe('10.5s');
  expect(formatter(60 * 1000)).toBe('1m');
  expect(formatter(90 * 1000)).toBe('1m 30s');
});
test('format seconds in human readable format with default options', () => {
  const formatter = createDurationFormatter({ multiplier: 1000 });
  expect(formatter(-0.5)).toBe('-500ms');
  expect(formatter(0.5)).toBe('500ms');
  expect(formatter(1)).toBe('1s');
  expect(formatter(30)).toBe('30s');
  expect(formatter(60)).toBe('1m');
  expect(formatter(90)).toBe('1m 30s');
});
test('format milliseconds in human readable format with additional pretty-ms options', () => {
  const colonNotationFormatter = createDurationFormatter({
    colonNotation: true,
  });
  expect(colonNotationFormatter(-10500)).toBe('-0:10.5');
  expect(colonNotationFormatter(10500)).toBe('0:10.5');
  const zeroDecimalFormatter = createDurationFormatter({
    secondsDecimalDigits: 0,
  });
  expect(zeroDecimalFormatter(10500)).toBe('10s');
  const subMillisecondFormatter = createDurationFormatter({
    formatSubMilliseconds: true,
  });
  expect(subMillisecondFormatter(100.40008)).toBe('100ms 400µs 80ns');
});
