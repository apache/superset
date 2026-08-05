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
import { CurrencyFormatter } from '@superset-ui/core';
import { GenericDataType } from '@apache-superset/core/common';
import { ValueFormatterParams } from '@superset-ui/core/components/ThemedAgGridReact';
import { formatColumnValue, valueFormatter, valueGetter } from '../src/utils/formatValue';
import DateWithFormatter from '../src/utils/DateWithFormatter';
import { DataColumnMeta, InputColumn } from '../src/types';

const baseCol: InputColumn = {
  key: 'order_date',
  label: 'order_date',
  dataType: GenericDataType.Temporal,
  isNumeric: false,
  isMetric: false,
  isPercentMetric: false,
  config: {},
};

function makeParams(value: unknown, node?: { level?: number }) {
  return {
    value,
    node,
    data: {},
  } as unknown as ValueFormatterParams;
}

test('valueFormatter never returns a raw Date/object when col.formatter is unset', () => {
  // Regression test: order_date (or any temporal column) is wrapped into a
  // DateWithFormatter instance before reaching this function. If col.formatter
  // is undefined - or returns a falsy result - the old `|| value` fallback
  // returned that raw object, which crashes React with "Objects are not valid
  // as a React child" once a cell renderer renders it directly.
  const date = new DateWithFormatter(1069113600000);
  const result = valueFormatter(makeParams(date), { ...baseCol, formatter: undefined });

  expect(typeof result).toBe('string');
  expect(result).not.toBe(date);
});

test('valueFormatter falls back to a string when the formatter returns a falsy result', () => {
  const date = new DateWithFormatter(1069113600000);
  const formatter = jest.fn().mockReturnValue('');
  const result = valueFormatter(makeParams(date), {
    ...baseCol,
    formatter: formatter as unknown as InputColumn['formatter'],
  });

  expect(typeof result).toBe('string');
  expect(result).not.toBe(date);
});

test('valueFormatter falls back to a string when the CurrencyFormatter returns a falsy result', () => {
  const currencyFormatter = new CurrencyFormatter({
    currency: { symbol: 'USD', symbolPosition: 'prefix' },
  });
  jest.spyOn(currencyFormatter, 'format').mockReturnValue('');

  const result = valueFormatter(makeParams(42), {
    ...baseCol,
    dataType: GenericDataType.Numeric,
    formatter: currencyFormatter,
  });

  expect(typeof result).toBe('string');
  expect(result).toBe('42');
});

test('valueFormatter uses the formatter result when it is truthy', () => {
  const formatter = jest.fn().mockReturnValue('2003-11-18');
  const result = valueFormatter(makeParams(new DateWithFormatter(1069113600000)), {
    ...baseCol,
    formatter: formatter as unknown as InputColumn['formatter'],
  });

  expect(result).toBe('2003-11-18');
});

test('valueFormatter returns N/A for a DateWithFormatter wrapping a null input', () => {
  const nullDate = new DateWithFormatter(null);
  const result = valueFormatter(makeParams(nullDate), baseCol);

  expect(result).toBe('N/A');
});

test('valueFormatter returns empty string for the root aggregation row', () => {
  const result = valueFormatter(makeParams(undefined, { level: -1 }), baseCol);

  expect(result).toBe('');
});

test('valueGetter returns the main column value when colDef.isMain is set', () => {
  const params = {
    colDef: { isMain: true },
    column: { getColId: () => 'sum__num' },
    data: { 'Main sum__num': 42 },
  } as unknown as Parameters<typeof valueGetter>[0];

  expect(valueGetter(params, baseCol)).toBe(42);
});

test('valueGetter returns undefined for missing numeric column values', () => {
  const params = {
    column: { getColId: () => 'sum__num' },
    data: {},
  } as unknown as Parameters<typeof valueGetter>[0];

  expect(valueGetter(params, { ...baseCol, isNumeric: true })).toBeUndefined();
});

test('valueGetter returns empty string for missing non-numeric column values', () => {
  const params = {
    column: { getColId: () => 'name' },
    data: {},
  } as unknown as Parameters<typeof valueGetter>[0];

  expect(valueGetter(params, baseCol)).toBe('');
});

test('formatColumnValue applies the small-number formatter for values under 1 in AUTO currency mode', () => {
  const column: DataColumnMeta = {
    key: 'pct',
    label: 'pct',
    dataType: GenericDataType.Numeric,
    isNumeric: true,
    isMetric: true,
    isPercentMetric: false,
    formatter: new CurrencyFormatter({ currency: { symbol: 'AUTO', symbolPosition: 'prefix' } }),
    config: {},
  };

  const [isHtml, formatted] = formatColumnValue(column, 0.005);

  expect(isHtml).toBe(false);
  expect(formatted).not.toBe('');
});

test('formatColumnValue renders null as N/A', () => {
  const column: DataColumnMeta = {
    ...baseCol,
    formatter: undefined,
  };

  expect(formatColumnValue(column, null)).toEqual([false, 'N/A']);
});
