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
import { CurrencyFormatter, getNumberFormatter } from '@superset-ui/core';
import { GenericDataType } from '@apache-superset/core/common';
import { formatColumnValue } from '../../src/utils/formatValue';
import { DataColumnMeta } from '../../src/types';

test('formatColumnValue with CurrencyFormatter AUTO mode uses row context', () => {
  const formatter = new CurrencyFormatter({
    d3Format: ',.2f',
    currency: { symbol: 'AUTO', symbolPosition: 'prefix' },
  });

  const column: DataColumnMeta = {
    key: 'revenue',
    label: 'Revenue',
    dataType: GenericDataType.Numeric,
    formatter,
    isNumeric: true,
    currencyCodeColumn: 'currency_code',
  };

  const rowData = { revenue: 1000, currency_code: 'EUR' };
  const [isHtml, result] = formatColumnValue(column, 1000, rowData);

  expect(isHtml).toBe(false);
  expect(result).toContain('€');
  expect(result).toContain('1,000.00');
});

test('formatColumnValue with CurrencyFormatter AUTO mode returns neutral format without row context', () => {
  const formatter = new CurrencyFormatter({
    d3Format: ',.2f',
    currency: { symbol: 'AUTO', symbolPosition: 'prefix' },
  });

  const column: DataColumnMeta = {
    key: 'revenue',
    label: 'Revenue',
    dataType: GenericDataType.Numeric,
    formatter,
    isNumeric: true,
    currencyCodeColumn: 'currency_code',
  };

  // No row data provided
  const [isHtml, result] = formatColumnValue(column, 1000);

  expect(isHtml).toBe(false);
  expect(result).toBe('1,000.00');
  expect(result).not.toContain('$');
  expect(result).not.toContain('€');
});

test('formatColumnValue with static CurrencyFormatter ignores row context', () => {
  const formatter = new CurrencyFormatter({
    d3Format: ',.2f',
    currency: { symbol: 'USD', symbolPosition: 'prefix' },
  });

  const column: DataColumnMeta = {
    key: 'revenue',
    label: 'Revenue',
    dataType: GenericDataType.Numeric,
    formatter,
    isNumeric: true,
  };

  // Row has EUR but static mode should show $
  const rowData = { revenue: 1000, currency_code: 'EUR' };
  const [isHtml, result] = formatColumnValue(column, 1000, rowData);

  expect(isHtml).toBe(false);
  expect(result).toContain('$');
  expect(result).not.toContain('€');
});

test('formatColumnValue with AUTO mode normalizes currency codes', () => {
  const formatter = new CurrencyFormatter({
    d3Format: ',.2f',
    currency: { symbol: 'AUTO', symbolPosition: 'prefix' },
  });

  const column: DataColumnMeta = {
    key: 'revenue',
    label: 'Revenue',
    dataType: GenericDataType.Numeric,
    formatter,
    isNumeric: true,
    currencyCodeColumn: 'currency_code',
  };

  // Test lowercase currency code
  const rowData1 = { revenue: 500, currency_code: 'usd' };
  const [, result1] = formatColumnValue(column, 500, rowData1);
  expect(result1).toContain('$');

  // Test uppercase currency code (GBP -> £)
  const rowData2 = { revenue: 750, currency_code: 'GBP' };
  const [, result2] = formatColumnValue(column, 750, rowData2);
  expect(result2).toContain('£');
});

test('formatColumnValue falls back to raw value when formatter throws', () => {
  const column: DataColumnMeta = {
    key: 'pct',
    label: 'Pct',
    dataType: GenericDataType.Numeric,
    formatter: (() => {
      throw new Error('boom');
    }) as unknown as DataColumnMeta['formatter'],
    isNumeric: true,
  };

  const [isHtml, result] = formatColumnValue(column, -0.00001229);

  expect(isHtml).toBe(false);
  expect(result).toBe('-0.00001229');
});

test('formatColumnValue falls back to raw value when CurrencyFormatter throws', () => {
  const formatter = new CurrencyFormatter({
    d3Format: ',.2f',
    currency: { symbol: 'AUTO', symbolPosition: 'prefix' },
  });
  formatter.format = () => {
    throw new Error('boom');
  };

  const column: DataColumnMeta = {
    key: 'revenue',
    label: 'Revenue',
    dataType: GenericDataType.Numeric,
    formatter,
    isNumeric: true,
    currencyCodeColumn: 'currency_code',
  };

  const [isHtml, result] = formatColumnValue(column, 1000, {
    revenue: 1000,
    currency_code: 'EUR',
  });

  expect(isHtml).toBe(false);
  expect(result).toBe('1000');
});

test('formatColumnValue handles null values', () => {
  const column: DataColumnMeta = {
    key: 'revenue',
    label: 'Revenue',
    dataType: GenericDataType.Numeric,
    formatter: getNumberFormatter(',.2f'),
    isNumeric: true,
  };

  const [, nullResult] = formatColumnValue(column, null);
  expect(nullResult).toBe('N/A');
});

test('formatColumnValue preserves percentage format for small numbers when d3SmallNumberFormat is null', () => {
  const formatter = getNumberFormatter('.8%');
  const column: DataColumnMeta = {
    key: 'pct',
    label: 'Percentage',
    dataType: GenericDataType.Numeric,
    formatter,
    isNumeric: true,
    config: { d3SmallNumberFormat: null },
  };

  const [, result] = formatColumnValue(column, -0.00001229);
  expect(result).toBe('-0.00122900%');
});

test('formatColumnValue preserves percentage format for small numbers when d3SmallNumberFormat is empty string', () => {
  const formatter = getNumberFormatter('.8%');
  const column: DataColumnMeta = {
    key: 'pct',
    label: 'Percentage',
    dataType: GenericDataType.Numeric,
    formatter,
    isNumeric: true,
    config: { d3SmallNumberFormat: '' },
  };

  const [, result] = formatColumnValue(column, -0.00001229);
  expect(result).toBe('-0.00122900%');
});

test('formatColumnValue preserves percentage format for small numbers when config has no d3SmallNumberFormat', () => {
  const formatter = getNumberFormatter('.8%');
  const column: DataColumnMeta = {
    key: 'pct',
    label: 'Percentage',
    dataType: GenericDataType.Numeric,
    formatter,
    isNumeric: true,
    config: {},
  };

  const [, result] = formatColumnValue(column, -0.00001229);
  expect(result).toBe('-0.00122900%');
});

test('formatColumnValue uses default formatter for value exactly 1 (boundary)', () => {
  const formatter = getNumberFormatter(',.2f');
  const column: DataColumnMeta = {
    key: 'val',
    label: 'Value',
    dataType: GenericDataType.Numeric,
    formatter,
    isNumeric: true,
    config: { d3SmallNumberFormat: null },
  };

  const [, result] = formatColumnValue(column, 1);
  expect(result).toBe('1.00');
});

test('formatColumnValue uses default formatter for value exactly -1 (boundary)', () => {
  const formatter = getNumberFormatter(',.2f');
  const column: DataColumnMeta = {
    key: 'val',
    label: 'Value',
    dataType: GenericDataType.Numeric,
    formatter,
    isNumeric: true,
    config: { d3SmallNumberFormat: null },
  };

  const [, result] = formatColumnValue(column, -1);
  expect(result).toBe('-1.00');
});

test('formatColumnValue uses small number formatter for value 0', () => {
  const formatter = getNumberFormatter('.8%');
  const column: DataColumnMeta = {
    key: 'pct',
    label: 'Percentage',
    dataType: GenericDataType.Numeric,
    formatter,
    isNumeric: true,
    config: { d3SmallNumberFormat: null },
  };

  const [, result] = formatColumnValue(column, 0);
  expect(result).toBe('0.00000000%');
});

test('formatColumnValue with small number format and currency', () => {
  const formatter = new CurrencyFormatter({
    d3Format: ',.2f',
    currency: { symbol: 'EUR', symbolPosition: 'prefix' },
  });

  const column: DataColumnMeta = {
    key: 'revenue',
    label: 'Revenue',
    dataType: GenericDataType.Numeric,
    formatter,
    isNumeric: true,
    config: {
      d3SmallNumberFormat: ',.4f',
      currencyFormat: { symbol: 'EUR', symbolPosition: 'prefix' },
    },
  };

  // Small number should use small number format
  const [, result] = formatColumnValue(column, 0.5);
  expect(result).toContain('€');
  expect(result).toContain('0.5000');
});

test('formatColumnValue supports bigint values without throwing', () => {
  // Original #44007 repro: integers > Number.MAX_SAFE_INTEGER parsed as native
  // BigInt must not throw "Cannot convert a BigInt value to a number".
  // Normalized to Number before any formatter, matching echarts (#42594).
  // Precision loss beyond MAX_SAFE_INTEGER is an accepted trade-off.
  const formatter = getNumberFormatter(',d');
  const column: DataColumnMeta = {
    key: 'big_val',
    label: 'Big Value',
    dataType: GenericDataType.Numeric,
    formatter,
    isNumeric: true,
  };

  // bigint is a valid DataRecordValue (see QueryResponse.ts)
  const bigValue = BigInt('1425300509404304697');
  expect(() => formatColumnValue(column, bigValue)).not.toThrow();
  const [, result] = formatColumnValue(column, bigValue);
  // Number(BigInt('1425300509404304697')) loses precision beyond MAX_SAFE_INTEGER
  // (same trade-off as echarts). The cell renders without crashing.
  expect(result).toBe('1,425,300,509,404,304,600');
});

test('regression #44079: large-integer STRING values format without throwing', () => {
  // After fixing #44079, parseResponse.ts emits large integers as decimal
  // strings instead of native bigint. The formatter must handle these
  // the same way — normalize to Number before passing to any formatter.
  const formatter = getNumberFormatter(',d');
  const column: DataColumnMeta = {
    key: 'big_str_val',
    label: 'Big String Value',
    dataType: GenericDataType.Numeric,
    formatter,
    isNumeric: true,
  };

  const largeIntString = '1425300509404304697';
  expect(() => formatColumnValue(column, largeIntString)).not.toThrow();
  const [, result] = formatColumnValue(column, largeIntString);
  // Same precision-loss trade-off as the bigint path.
  expect(result).toBe('1,425,300,509,404,304,600');
});

test('regression #44079: MEMORY_BINARY formatter with large-integer string does not crash', () => {
  // The MEMORY_BINARY formatter was the original crash vector in #44007.
  // Confirm it still works with the new string form from parseResponse.ts.
  const formatter = getNumberFormatter('MEMORY_BINARY');
  const column: DataColumnMeta = {
    key: 'mem',
    label: 'Memory',
    dataType: GenericDataType.Numeric,
    formatter,
    isNumeric: true,
  };

  expect(() => formatColumnValue(column, '1425300509404304697')).not.toThrow();
});

test('formatColumnValue: floats are not affected by the integer-string guard', () => {
  // The /^-?\d+$/ regex rejects float strings, so they flow through to the
  // formatter as-is. Pass values as strings to actually exercise the regex
  // rejection path (passing numbers bypasses the string guard entirely).
  const formatter = getNumberFormatter(',.4f');
  const column: DataColumnMeta = {
    key: 'flt',
    label: 'Float',
    dataType: GenericDataType.Numeric,
    formatter,
    isNumeric: true,
  };

  // Float strings: /^-?\d+$/ rejects these, so they reach formatter as strings
  // and NumberFormatter's own parseFloat handles them.
  expect(formatColumnValue(column, '3.14159')[1]).toBe('3.1416');
  expect(formatColumnValue(column, '-0.001')[1]).toBe('-0.0010');
  // Scientific notation string: also rejected by /^-?\d+$/ regex
  expect(formatColumnValue(column, '1.5e10')[1]).toBe('15,000,000,000.0000');
});

test('formatColumnValue: NaN and Infinity are not affected by the integer-string guard', () => {
  // NaN and Infinity must never be coerced by /^-?\d+$/ — they flow through
  // as-is so NumberFormatter can handle them with its own special-case logic.
  const formatter = getNumberFormatter(',d');
  const column: DataColumnMeta = {
    key: 'val',
    label: 'Value',
    dataType: GenericDataType.Numeric,
    formatter,
    isNumeric: true,
  };

  expect(() => formatColumnValue(column, NaN)).not.toThrow();
  expect(formatColumnValue(column, NaN)[1]).toBe('NaN');
  expect(() => formatColumnValue(column, Infinity)).not.toThrow();
  expect(formatColumnValue(column, Infinity)[1]).toBe('∞');
  expect(() => formatColumnValue(column, -Infinity)).not.toThrow();
  expect(formatColumnValue(column, -Infinity)[1]).toBe('-∞');
});

test('formatColumnValue: normal small integers are not affected', () => {
  // Small integers arrive as regular JS numbers; the bigint/string guard must
  // not change their behavior in any way.
  const formatter = getNumberFormatter(',d');
  const column: DataColumnMeta = {
    key: 'n',
    label: 'Number',
    dataType: GenericDataType.Numeric,
    formatter,
    isNumeric: true,
  };

  expect(formatColumnValue(column, 0)[1]).toBe('0');
  expect(formatColumnValue(column, 42)[1]).toBe('42');
  expect(formatColumnValue(column, -1000)[1]).toBe('-1,000');
  // Number.MAX_SAFE_INTEGER — exactly at the boundary, still a regular number
  expect(formatColumnValue(column, 9007199254740991)[1]).toBe(
    '9,007,199,254,740,991',
  );
});
