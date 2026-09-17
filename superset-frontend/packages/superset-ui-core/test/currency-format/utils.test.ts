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
  CurrencyFormatter,
  getCustomFormatter,
  getNumberFormatter,
  getValueFormatter,
  NumberFormatter,
  ValueFormatter,
} from '@superset-ui/core';

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
