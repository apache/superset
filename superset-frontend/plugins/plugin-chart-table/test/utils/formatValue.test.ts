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
import { GenericDataType } from '@apache-superset/core/api/core';
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
