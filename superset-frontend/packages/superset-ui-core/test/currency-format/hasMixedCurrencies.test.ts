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

import { hasMixedCurrencies } from '../../src/currency-format/CurrencyFormatter';

test('hasMixedCurrencies detects different currencies', () => {
  expect(hasMixedCurrencies(['USD', 'EUR'])).toBe(true);
  expect(hasMixedCurrencies(['USD', 'EUR', 'GBP'])).toBe(true);
  expect(hasMixedCurrencies(['EUR', 'JPY'])).toBe(true);
});

test('hasMixedCurrencies normalizes before comparing', () => {
  // These are all USD after normalization
  expect(hasMixedCurrencies(['USD', 'usd', '$'])).toBe(false);
  // These are all EUR
  expect(hasMixedCurrencies(['EUR', 'eur', '€'])).toBe(false);
  // These are all GBP
  expect(hasMixedCurrencies(['GBP', 'gbp', '£'])).toBe(false);
});

test('hasMixedCurrencies returns false for single currency', () => {
  expect(hasMixedCurrencies(['USD'])).toBe(false);
  expect(hasMixedCurrencies(['EUR', 'EUR', 'EUR'])).toBe(false);
  expect(hasMixedCurrencies(['GBP', 'GBP'])).toBe(false);
});

test('hasMixedCurrencies handles empty array', () => {
  expect(hasMixedCurrencies([])).toBe(false);
});

test('hasMixedCurrencies ignores null values', () => {
  expect(hasMixedCurrencies(['USD', null, 'USD'])).toBe(false);
  expect(hasMixedCurrencies([null, null])).toBe(false);
  expect(hasMixedCurrencies(['USD', null, 'EUR'])).toBe(true);
});
