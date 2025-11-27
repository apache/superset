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

import { normalizeCurrency } from '../../src/currency-format/CurrencyFormatter';

test('normalizeCurrency converts lowercase ISO codes to uppercase', () => {
  expect(normalizeCurrency('usd')).toBe('USD');
  expect(normalizeCurrency('eur')).toBe('EUR');
  expect(normalizeCurrency('gbp')).toBe('GBP');
  expect(normalizeCurrency('jpy')).toBe('JPY');
});

test('normalizeCurrency maps common currency symbols', () => {
  expect(normalizeCurrency('$')).toBe('USD');
  expect(normalizeCurrency('€')).toBe('EUR');
  expect(normalizeCurrency('£')).toBe('GBP');
  expect(normalizeCurrency('¥')).toBe('JPY');
  expect(normalizeCurrency('₹')).toBe('INR');
});

test('normalizeCurrency returns ISO codes unchanged', () => {
  expect(normalizeCurrency('USD')).toBe('USD');
  expect(normalizeCurrency('EUR')).toBe('EUR');
  expect(normalizeCurrency('GBP')).toBe('GBP');
  expect(normalizeCurrency('JPY')).toBe('JPY');
});

test('normalizeCurrency handles null and undefined', () => {
  expect(normalizeCurrency(null)).toBe(null);
  expect(normalizeCurrency(undefined)).toBe(null);
  expect(normalizeCurrency('')).toBe(null);
});

test('normalizeCurrency handles whitespace', () => {
  expect(normalizeCurrency(' USD ')).toBe('USD');
  expect(normalizeCurrency(' usd ')).toBe('USD');
});

test('normalizeCurrency maps full currency names', () => {
  expect(normalizeCurrency('EURO')).toBe('EUR');
  expect(normalizeCurrency('euro')).toBe('EUR');
  expect(normalizeCurrency('EUROS')).toBe('EUR');
  expect(normalizeCurrency('euros')).toBe('EUR');
  expect(normalizeCurrency('DOLLAR')).toBe('USD');
  expect(normalizeCurrency('dollar')).toBe('USD');
  expect(normalizeCurrency('DOLLARS')).toBe('USD');
  expect(normalizeCurrency('POUND')).toBe('GBP');
  expect(normalizeCurrency('POUNDS')).toBe('GBP');
  expect(normalizeCurrency('YEN')).toBe('JPY');
  expect(normalizeCurrency('RUPEE')).toBe('INR');
  expect(normalizeCurrency('RUPEES')).toBe('INR');
});
