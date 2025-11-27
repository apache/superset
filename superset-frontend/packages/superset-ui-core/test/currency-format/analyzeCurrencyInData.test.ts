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
import { analyzeCurrencyInData } from '../../src/currency-format/utils';

describe('analyzeCurrencyInData', () => {
  test('returns null when currencyColumn is undefined', () => {
    const data = [{ currency: 'USD', value: 100 }];
    expect(analyzeCurrencyInData(data, undefined)).toBeNull();
  });

  test('returns null when data is empty', () => {
    expect(analyzeCurrencyInData([], 'currency_code')).toBeNull();
  });

  test('returns normalized currency code for single currency', () => {
    const data = [
      { currency_code: 'USD', value: 100 },
      { currency_code: 'usd', value: 200 },
      { currency_code: 'USD', value: 300 },
    ];
    expect(analyzeCurrencyInData(data, 'currency_code')).toBe('USD');
  });

  test('returns normalized currency code for single currency symbol', () => {
    const data = [
      { currency_code: '€', value: 100 },
      { currency_code: '€', value: 200 },
      { currency_code: '€', value: 300 },
    ];
    expect(analyzeCurrencyInData(data, 'currency_code')).toBe('EUR');
  });

  test('returns null for mixed currencies', () => {
    const data = [
      { currency_code: 'USD', value: 100 },
      { currency_code: 'EUR', value: 200 },
      { currency_code: 'GBP', value: 300 },
    ];
    expect(analyzeCurrencyInData(data, 'currency_code')).toBeNull();
  });

  test('returns null for mixed currency symbols', () => {
    const data = [
      { currency_code: '$', value: 100 },
      { currency_code: '€', value: 200 },
      { currency_code: '£', value: 300 },
    ];
    expect(analyzeCurrencyInData(data, 'currency_code')).toBeNull();
  });

  test('ignores null and undefined values', () => {
    const data = [
      { currency_code: 'USD', value: 100 },
      { currency_code: null, value: 200 },
      { currency_code: undefined, value: 300 },
      { currency_code: 'USD', value: 400 },
    ];
    expect(analyzeCurrencyInData(data, 'currency_code')).toBe('USD');
  });

  test('returns null when all currency values are null or undefined', () => {
    const data = [
      { currency_code: null, value: 100 },
      { currency_code: undefined, value: 200 },
    ];
    expect(analyzeCurrencyInData(data, 'currency_code')).toBeNull();
  });

  test('handles single row with currency', () => {
    const data = [{ currency_code: 'JPY', value: 100 }];
    expect(analyzeCurrencyInData(data, 'currency_code')).toBe('JPY');
  });

  test('returns null for invalid currency values', () => {
    const data = [
      { currency_code: 'INVALID', value: 100 },
      { currency_code: 'INVALID', value: 200 },
    ];
    expect(analyzeCurrencyInData(data, 'currency_code')).toBeNull();
  });
});
