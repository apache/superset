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
import {
  calculateMA,
  movingAverageName,
  parseMovingAveragePeriods,
} from '../../src/Candlestick/utils';

test('parses numeric and MA-prefixed periods', () => {
  expect(parseMovingAveragePeriods([5, 'MA10', '15', 'MA15'])).toEqual([
    5, 10, 15,
  ]);
});

test('drops invalid moving-average periods', () => {
  expect(parseMovingAveragePeriods([1, 0, -5, 'foo', 2.5, 5])).toEqual([5]);
});

test('calculateMA matches the ECharts candlestick example', () => {
  // First `period` points are '-', then mean of close[i] .. close[i-period+1].
  const closes = [10, 20, 30, 40, 50, 60, 70, 80];
  expect(calculateMA(closes, 5)).toEqual(['-', '-', '-', '-', '-', 40, 50, 60]);
});

test('calculateMA skips windows that contain missing closes', () => {
  expect(calculateMA([10, null, 30, 40], 2)).toEqual(['-', '-', '-', 35]);
});

test('movingAverageName qualifies the series when needed', () => {
  expect(movingAverageName(5)).toBe('MA5');
  expect(movingAverageName(10, 'AAPL')).toBe('AAPL MA10');
});
