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
  buildCustomFormatters,
  Currency,
  CurrencyFormatter,
  getCustomFormatter,
  getNumberFormatter,
  getValueFormatter,
  NumberFormatter,
  ValueFormatter,
} from '@superset-ui/core';
import {
  analyzeCurrencyInData,
  resolveAutoCurrency,
} from '../../src/currency-format/utils';

test('buildCustomFormatters without saved metrics returns empty object', () => {
  expect(
    buildCustomFormatters(
      [
        {
          expressionType: 'SIMPLE',
          aggregate: 'COUNT',
          column: { column_name: 'test' },
        },
      ],
      {
        sum__num: { symbol: 'USD', symbolPosition: 'prefix' },
      },
      {},
      ',.1f',
      undefined,
    ),
  ).toEqual({});

  expect(
    buildCustomFormatters(
      undefined,
      {
        sum__num: { symbol: 'USD', symbolPosition: 'prefix' },
      },
      {},
      ',.1f',
      undefined,
    ),
  ).toEqual({});
});

test('buildCustomFormatters with saved metrics returns custom formatters object', () => {
  const customFormatters: Record<string, ValueFormatter> =
    buildCustomFormatters(
      [
        {
          expressionType: 'SIMPLE',
          aggregate: 'COUNT',
          column: { column_name: 'test' },
        },
        'sum__num',
        'count',
      ],
      {
        sum__num: { symbol: 'USD', symbolPosition: 'prefix' },
      },
      { sum__num: ',.2' },
      ',.1f',
      undefined,
    );

  expect(customFormatters).toEqual({
    sum__num: expect.any(Function),
    count: expect.any(Function),
  });

  expect(customFormatters.sum__num).toBeInstanceOf(CurrencyFormatter);
  expect(customFormatters.count).toBeInstanceOf(NumberFormatter);
  expect((customFormatters.sum__num as CurrencyFormatter).d3Format).toEqual(
    ',.1f',
  );
});

test('buildCustomFormatters uses dataset d3 format if not provided in control panel', () => {
  const customFormatters: Record<string, ValueFormatter> =
    buildCustomFormatters(
      [
        {
          expressionType: 'SIMPLE',
          aggregate: 'COUNT',
          column: { column_name: 'test' },
        },
        'sum__num',
        'count',
      ],
      {
        sum__num: { symbol: 'USD', symbolPosition: 'prefix' },
      },
      { sum__num: ',.2' },
      undefined,
      undefined,
    );

  expect((customFormatters.sum__num as CurrencyFormatter).d3Format).toEqual(
    ',.2',
  );
});

test('buildCustomFormatters returns NumberFormatter for a d3format with currency set to {}', () => {
  const customFormatters: Record<string, ValueFormatter> =
    buildCustomFormatters(
      ['count'],
      { count: {} as Currency },
      { count: ',.2%' },
      undefined,
      undefined,
    );

  expect(customFormatters.count).toBeInstanceOf(NumberFormatter);
});

test('getCustomFormatter', () => {
  const customFormatters = {
    sum__num: new CurrencyFormatter({
      currency: { symbol: 'USD', symbolPosition: 'prefix' },
    }),
    count: getNumberFormatter(),
  };
  expect(getCustomFormatter(customFormatters, 'count')).toEqual(
    customFormatters.count,
  );
  expect(
    getCustomFormatter(customFormatters, ['count', 'sum__num'], 'count'),
  ).toEqual(customFormatters.count);
  expect(getCustomFormatter(customFormatters, ['count', 'sum__num'])).toEqual(
    undefined,
  );
});

test('getValueFormatter', () => {
  expect(
    getValueFormatter(['count', 'sum__num'], {}, {}, ',.1f', undefined),
  ).toBeInstanceOf(NumberFormatter);

  expect(
    getValueFormatter(
      ['count', 'sum__num'],
      {},
      {},
      ',.1f',
      undefined,
      'count',
    ),
  ).toBeInstanceOf(NumberFormatter);

  expect(
    getValueFormatter(
      ['count', 'sum__num'],
      { count: { symbol: 'USD', symbolPosition: 'prefix' } },
      {},
      ',.1f',
      undefined,
      'count',
    ),
  ).toBeInstanceOf(CurrencyFormatter);
});

test('getValueFormatter with currency from control panel', () => {
  const countFormatter = getValueFormatter(
    ['count', 'sum__num'],
    { count: { symbol: 'USD', symbolPosition: 'prefix' } },
    {},
    ',.1f',
    { symbol: 'EUR', symbolPosition: 'suffix' },
    'count',
  );
  expect(countFormatter).toBeInstanceOf(CurrencyFormatter);
  expect((countFormatter as CurrencyFormatter).currency).toEqual({
    symbol: 'EUR',
    symbolPosition: 'suffix',
  });
});

test('getValueFormatter with currency from control panel when no saved currencies', () => {
  const formatter = getValueFormatter(
    ['count', 'sum__num'],
    {},
    {},
    ',.1f',
    { symbol: 'EUR', symbolPosition: 'suffix' },
    undefined,
  );
  expect(formatter).toBeInstanceOf(CurrencyFormatter);
  expect((formatter as CurrencyFormatter).currency).toEqual({
    symbol: 'EUR',
    symbolPosition: 'suffix',
  });
});

test('getValueFormatter return NumberFormatter when no currency formatters', () => {
  const formatter = getValueFormatter(
    ['count', 'sum__num'],
    {},
    {},
    ',.1f',
    undefined,
    undefined,
  );
  expect(formatter).toBeInstanceOf(NumberFormatter);
});

test('analyzeCurrencyInData returns null when all currency values are null/undefined', () => {
  const data = [
    { value: 100, currency: null },
    { value: 200, currency: undefined },
  ];
  expect(analyzeCurrencyInData(data as any, 'currency')).toBeNull();
});

test('analyzeCurrencyInData returns null when currencyColumn is not provided', () => {
  expect(analyzeCurrencyInData([{ value: 100 }], undefined)).toBeNull();
});

test('analyzeCurrencyInData returns detected currency for consistent values', () => {
  const data = [
    { value: 100, currency: 'USD' },
    { value: 200, currency: 'USD' },
  ];
  expect(analyzeCurrencyInData(data, 'currency')).toBe('USD');
});

test('resolveAutoCurrency returns currencyFormat unchanged when not AUTO', () => {
  const currency: Currency = { symbol: 'USD', symbolPosition: 'prefix' };
  expect(resolveAutoCurrency(currency, null)).toEqual(currency);
});

test('resolveAutoCurrency returns currency from backendDetected when AUTO', () => {
  const currency: Currency = { symbol: 'AUTO', symbolPosition: 'prefix' };
  const result = resolveAutoCurrency(currency, 'EUR');
  expect(result).toEqual({ symbol: 'EUR', symbolPosition: 'prefix' });
});

test('resolveAutoCurrency returns null when AUTO and no detection source', () => {
  const currency: Currency = { symbol: 'AUTO', symbolPosition: 'prefix' };
  expect(resolveAutoCurrency(currency, null)).toBeNull();
});

test('resolveAutoCurrency detects currency from data when backendDetected is undefined', () => {
  const currency: Currency = { symbol: 'AUTO', symbolPosition: 'suffix' };
  const data = [
    { value: 100, cur: 'JPY' },
    { value: 200, cur: 'JPY' },
  ];
  const result = resolveAutoCurrency(currency, undefined, data, 'cur');
  expect(result).toEqual({ symbol: 'JPY', symbolPosition: 'suffix' });
});

test('resolveAutoCurrency returns null when data analysis finds mixed currencies', () => {
  const currency: Currency = { symbol: 'AUTO', symbolPosition: 'prefix' };
  const data = [{ cur: 'USD' }, { cur: 'EUR' }];
  const result = resolveAutoCurrency(currency, undefined, data, 'cur');
  expect(result).toBeNull();
});

test('buildCustomFormatters with AUTO currency and data resolves currency', () => {
  const data = [{ metric: 1, currency: 'EUR' }];
  const result = buildCustomFormatters(
    ['metric'],
    {},
    {},
    ',.2f',
    { symbol: 'AUTO', symbolPosition: 'prefix' },
    data,
    'currency',
  ) as Record<string, ValueFormatter>;
  expect(result).toHaveProperty('metric');
  expect(result.metric).toBeInstanceOf(CurrencyFormatter);
});

test('buildCustomFormatters with AUTO currency and no detected currency returns NumberFormatter', () => {
  // Mixed currencies → null resolved format → NumberFormatter
  const data = [
    { metric: 1, currency: 'USD' },
    { metric: 2, currency: 'EUR' },
  ];
  const result = buildCustomFormatters(
    ['metric'],
    {},
    {},
    ',.2f',
    { symbol: 'AUTO', symbolPosition: 'prefix' },
    data,
    'currency',
  ) as Record<string, ValueFormatter>;
  expect(result).toHaveProperty('metric');
  expect(result.metric).toBeInstanceOf(NumberFormatter);
});

test('getValueFormatter with AUTO currency and detectedCurrency provided', () => {
  const formatter = getValueFormatter(
    ['count'],
    {},
    {},
    ',.1f',
    { symbol: 'AUTO', symbolPosition: 'prefix' },
    'count',
    undefined,
    undefined,
    'USD',
  );
  expect(formatter).toBeInstanceOf(CurrencyFormatter);
});

test('getValueFormatter with AUTO currency and null detectedCurrency returns NumberFormatter', () => {
  const formatter = getValueFormatter(
    ['count'],
    {},
    {},
    ',.1f',
    { symbol: 'AUTO', symbolPosition: 'prefix' },
    'count',
    undefined,
    undefined,
    null,
  );
  expect(formatter).toBeInstanceOf(NumberFormatter);
});

test('getValueFormatter with AUTO currency and data + currencyCodeColumn', () => {
  const data = [
    { count: 100, currency: 'GBP' },
    { count: 200, currency: 'GBP' },
  ];
  const formatter = getValueFormatter(
    ['count'],
    {},
    {},
    ',.1f',
    { symbol: 'AUTO', symbolPosition: 'suffix' },
    'count',
    data,
    'currency',
  );
  expect(formatter).toBeInstanceOf(CurrencyFormatter);
});

test('getValueFormatter with AUTO currency, data+column but mixed currencies falls back to NumberFormatter (line 178 false branch)', () => {
  // Mixed currencies → analyzeCurrencyInData returns null → frontendDetected falsy
  // → resolvedCurrencyFormat = null (the ternary false branch at line 178)
  const data = [
    { count: 100, currency: 'USD' },
    { count: 200, currency: 'EUR' },
  ];
  const formatter = getValueFormatter(
    ['count'],
    {},
    {},
    ',.1f',
    { symbol: 'AUTO', symbolPosition: 'prefix' },
    'count',
    data,
    'currency',
  );
  expect(formatter).toBeInstanceOf(NumberFormatter);
});

test('getValueFormatter with AUTO currency and no data falls back to NumberFormatter', () => {
  const formatter = getValueFormatter(
    ['count'],
    {},
    {},
    ',.1f',
    { symbol: 'AUTO', symbolPosition: 'prefix' },
    'count',
  );
  expect(formatter).toBeInstanceOf(NumberFormatter);
});

test('getValueFormatter returns NumberFormatter via line 205 when AUTO resolves to null and metrics are all adhoc', () => {
  // String metrics produce a NumberFormatter entry in buildCustomFormatters,
  // making customFormatter truthy and bypassing line 205. Adhoc metric objects
  // are skipped by buildCustomFormatters, so customFormatter stays undefined,
  // and the resolvedCurrencyFormat === null branch at line 205 is reached.
  const adhocMetric = {
    expressionType: 'SIMPLE' as const,
    aggregate: 'COUNT' as const,
    column: { column_name: 'test' },
  };
  const formatter = getValueFormatter(
    [adhocMetric],
    {},
    {},
    ',.1f',
    { symbol: 'AUTO', symbolPosition: 'prefix' },
    'some_key',
    undefined, // no data → else branch → resolvedCurrencyFormat = null
  );
  expect(formatter).toBeInstanceOf(NumberFormatter);
});
