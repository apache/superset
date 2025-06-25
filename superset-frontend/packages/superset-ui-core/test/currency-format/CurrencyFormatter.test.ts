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

import {
  CurrencyFormatter,
  getCurrencySymbol,
  NumberFormats,
} from '@superset-ui/core';

it('getCurrencySymbol', () => {
  expect(
    getCurrencySymbol({ symbol: 'PLN', symbolPosition: 'prefix' }),
  ).toEqual('PLN');
  expect(
    getCurrencySymbol({ symbol: 'USD', symbolPosition: 'prefix' }),
  ).toEqual('$');

  expect(() =>
    getCurrencySymbol({ symbol: 'INVALID_CODE', symbolPosition: 'prefix' }),
  ).toThrow(RangeError);
});

it('CurrencyFormatter object fields', () => {
  const defaultCurrencyFormatter = new CurrencyFormatter({
    currency: { symbol: 'USD', symbolPosition: 'prefix' },
  });
  expect(defaultCurrencyFormatter.d3Format).toEqual(NumberFormats.SMART_NUMBER);
  expect(defaultCurrencyFormatter.locale).toEqual('en-US');
  expect(defaultCurrencyFormatter.currency).toEqual({
    symbol: 'USD',
    symbolPosition: 'prefix',
  });

  const currencyFormatter = new CurrencyFormatter({
    currency: { symbol: 'PLN', symbolPosition: 'suffix' },
    locale: 'pl-PL',
    d3Format: ',.1f',
  });
  expect(currencyFormatter.d3Format).toEqual(',.1f');
  expect(currencyFormatter.locale).toEqual('pl-PL');
  expect(currencyFormatter.currency).toEqual({
    symbol: 'PLN',
    symbolPosition: 'suffix',
  });
});

it('CurrencyFormatter:hasValidCurrency', () => {
  const currencyFormatter = new CurrencyFormatter({
    currency: { symbol: 'USD', symbolPosition: 'prefix' },
  });
  expect(currencyFormatter.hasValidCurrency()).toBe(true);

  const currencyFormatterWithoutPosition = new CurrencyFormatter({
    // @ts-ignore
    currency: { symbol: 'USD' },
  });
  expect(currencyFormatterWithoutPosition.hasValidCurrency()).toBe(true);

  const currencyFormatterWithoutSymbol = new CurrencyFormatter({
    // @ts-ignore
    currency: { symbolPosition: 'prefix' },
  });
  expect(currencyFormatterWithoutSymbol.hasValidCurrency()).toBe(false);

  // @ts-ignore
  const currencyFormatterWithoutCurrency = new CurrencyFormatter({});
  expect(currencyFormatterWithoutCurrency.hasValidCurrency()).toBe(false);
});

it('CurrencyFormatter:getNormalizedD3Format', () => {
  const currencyFormatter = new CurrencyFormatter({
    currency: { symbol: 'USD', symbolPosition: 'prefix' },
  });
  expect(currencyFormatter.getNormalizedD3Format()).toEqual(
    currencyFormatter.d3Format,
  );

  const currencyFormatter2 = new CurrencyFormatter({
    currency: { symbol: 'USD', symbolPosition: 'prefix' },
    d3Format: ',.1f',
  });
  expect(currencyFormatter2.getNormalizedD3Format()).toEqual(
    currencyFormatter2.d3Format,
  );

  const currencyFormatter3 = new CurrencyFormatter({
    currency: { symbol: 'USD', symbolPosition: 'prefix' },
    d3Format: '$,.1f',
  });
  expect(currencyFormatter3.getNormalizedD3Format()).toEqual(',.1f');

  const currencyFormatter4 = new CurrencyFormatter({
    currency: { symbol: 'USD', symbolPosition: 'prefix' },
    d3Format: ',.1%',
  });
  expect(currencyFormatter4.getNormalizedD3Format()).toEqual(',.1');
});

it('CurrencyFormatter:format', () => {
  const VALUE = 56100057;
  const currencyFormatterWithPrefix = new CurrencyFormatter({
    currency: { symbol: 'USD', symbolPosition: 'prefix' },
  });

  expect(currencyFormatterWithPrefix(VALUE)).toEqual(
    currencyFormatterWithPrefix.format(VALUE),
  );
  expect(currencyFormatterWithPrefix(VALUE)).toEqual('$ 56.1M');

  const currencyFormatterWithSuffix = new CurrencyFormatter({
    currency: { symbol: 'USD', symbolPosition: 'suffix' },
  });
  expect(currencyFormatterWithSuffix(VALUE)).toEqual('56.1M $');

  const currencyFormatterWithoutPosition = new CurrencyFormatter({
    // @ts-ignore
    currency: { symbol: 'USD' },
  });
  expect(currencyFormatterWithoutPosition(VALUE)).toEqual('56.1M $');

  // @ts-ignore
  const currencyFormatterWithoutCurrency = new CurrencyFormatter({});
  expect(currencyFormatterWithoutCurrency(VALUE)).toEqual('56.1M');

  const currencyFormatterWithCustomD3 = new CurrencyFormatter({
    currency: { symbol: 'USD', symbolPosition: 'prefix' },
    d3Format: ',.1f',
  });
  expect(currencyFormatterWithCustomD3(VALUE)).toEqual('$ 56,100,057.0');

  const currencyFormatterWithPercentD3 = new CurrencyFormatter({
    currency: { symbol: 'USD', symbolPosition: 'prefix' },
    d3Format: ',.1f%',
  });
  expect(currencyFormatterWithPercentD3(VALUE)).toEqual('$ 56,100,057.0');

  const currencyFormatterWithCurrencyD3 = new CurrencyFormatter({
    currency: { symbol: 'PLN', symbolPosition: 'suffix' },
    d3Format: '$,.1f',
  });
  expect(currencyFormatterWithCurrencyD3(VALUE)).toEqual('56,100,057.0 PLN');
});
