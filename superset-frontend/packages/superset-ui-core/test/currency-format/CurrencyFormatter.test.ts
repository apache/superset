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

import { CurrencyFormatter, getCurrencySymbol } from '@superset-ui/core';

test('getCurrencySymbol returns symbol for valid currency', () => {
  expect(getCurrencySymbol({ symbol: 'USD', symbolPosition: 'prefix' })).toBe(
    '$',
  );
  expect(getCurrencySymbol({ symbol: 'EUR', symbolPosition: 'prefix' })).toBe(
    '€',
  );
  expect(() =>
    getCurrencySymbol({ symbol: 'INVALID', symbolPosition: 'prefix' }),
  ).toThrow(RangeError);
});

test('CurrencyFormatter formats with prefix and suffix', () => {
  const prefix = new CurrencyFormatter({
    currency: { symbol: 'USD', symbolPosition: 'prefix' },
    d3Format: ',.2f',
  });
  expect(prefix(1000)).toBe('$ 1,000.00');

  const suffix = new CurrencyFormatter({
    currency: { symbol: 'EUR', symbolPosition: 'suffix' },
    d3Format: ',.2f',
  });
  expect(suffix(1000)).toBe('1,000.00 €');
});

test('CurrencyFormatter AUTO mode uses row context', () => {
  const formatter = new CurrencyFormatter({
    currency: { symbol: 'AUTO', symbolPosition: 'prefix' },
    d3Format: ',.2f',
  });

  const row = { currency: 'EUR' };
  expect(formatter.format(1000, row, 'currency')).toContain('€');
  expect(formatter.format(1000)).toBe('1,000.00'); // No context = neutral
});

test('CurrencyFormatter static mode ignores row context', () => {
  const formatter = new CurrencyFormatter({
    currency: { symbol: 'USD', symbolPosition: 'prefix' },
    d3Format: ',.2f',
  });

  const row = { currency: 'EUR' };
  expect(formatter.format(1000, row, 'currency')).toContain('$');
});
