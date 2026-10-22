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
import { GenericDataType } from '@apache-superset/core/common';
import {
  coerceConditionValue,
  getAllowedOperators,
  getConditionError,
  getConditionExtraFormData,
  getConditionLabel,
  isConditionComplete,
} from './utils';

test('unary operators are complete without a value', () => {
  expect(isConditionComplete({ op: 'IS NULL' })).toBe(true);
  expect(isConditionComplete({ op: 'IS NOT NULL' })).toBe(true);
});

test('binary operators need a non-blank value', () => {
  expect(isConditionComplete({ op: '>' })).toBe(false);
  expect(isConditionComplete({ op: '>', val: '' })).toBe(false);
  expect(isConditionComplete({ op: '>', val: 0 })).toBe(true);
  expect(isConditionComplete({ op: '==', val: false })).toBe(true);
});

test('set operators need at least one value', () => {
  expect(isConditionComplete({ op: 'IN', val: [] })).toBe(false);
  expect(isConditionComplete({ op: 'IN', val: [''] })).toBe(false);
  expect(isConditionComplete({ op: 'NOT IN', val: ['US'] })).toBe(true);
});

test('unknown operators are never complete', () => {
  // @ts-expect-error testing a value restored from an old permalink
  expect(isConditionComplete({ op: 'BETWEEN', val: 1 })).toBe(false);
  expect(isConditionComplete(null)).toBe(false);
});

test('numeric columns cast typed values to numbers', () => {
  expect(coerceConditionValue('100', '>', GenericDataType.Numeric)).toBe(100);
  expect(coerceConditionValue('abc', '>', GenericDataType.Numeric)).toBe('abc');
  expect(coerceConditionValue('100', '>', GenericDataType.String)).toBe('100');
  expect(coerceConditionValue('1%', 'LIKE', GenericDataType.Numeric)).toBe(
    '1%',
  );
});

test('builds a binary clause', () => {
  expect(
    getConditionExtraFormData(
      'price',
      { op: '>', val: '100' },
      GenericDataType.Numeric,
    ),
  ).toEqual({ filters: [{ col: 'price', op: '>', val: 100 }] });
});

test('builds a unary clause without val', () => {
  expect(getConditionExtraFormData('country', { op: 'IS NULL' })).toEqual({
    filters: [{ col: 'country', op: 'IS NULL' }],
  });
});

test('builds a set clause and drops blank items', () => {
  expect(
    getConditionExtraFormData('country', {
      op: 'IN',
      val: ['CA', '', 'US'],
    }),
  ).toEqual({ filters: [{ col: 'country', op: 'IN', val: ['CA', 'US'] }] });
});

test('incomplete conditions produce no filters', () => {
  expect(getConditionExtraFormData('price', { op: '<' })).toEqual({});
  expect(getConditionExtraFormData('', { op: 'IS NULL' })).toEqual({});
});

test('labels read like a condition', () => {
  expect(getConditionLabel('price', { op: '>', val: 100 })).toBe('price > 100');
  expect(getConditionLabel('country', { op: 'IN', val: ['CA', 'US'] })).toBe(
    'country IN (CA, US)',
  );
  expect(getConditionLabel('country', { op: 'IS NULL' })).toBe(
    'country IS NULL',
  );
  expect(getConditionLabel('country', { op: '==' })).toBe('');
});

test('operators depend on the column type', () => {
  expect(getAllowedOperators(GenericDataType.String)).toContain('LIKE');
  expect(getAllowedOperators(GenericDataType.String)).not.toContain('>');
  expect(getAllowedOperators(GenericDataType.Numeric)).toContain('>');
  expect(getAllowedOperators(GenericDataType.Numeric)).not.toContain('LIKE');
  expect(getAllowedOperators(GenericDataType.Temporal)).toContain('>=');
  expect(getAllowedOperators(GenericDataType.Temporal)).not.toContain('IN');
  expect(getAllowedOperators(GenericDataType.Boolean)).toEqual([
    '==',
    '!=',
    'IS NULL',
    'IS NOT NULL',
  ]);
  expect(getAllowedOperators(GenericDataType.MultiValue)).toEqual([
    'IS NULL',
    'IS NOT NULL',
  ]);
});

test('an unknown column type allows every operator', () => {
  expect(getAllowedOperators(undefined)).toHaveLength(11);
  expect(getAllowedOperators(null)).toHaveLength(11);
});

test('a saved operator that no longer fits the column type is an error', () => {
  // e.g. the column changed from string to numeric after the filter was saved
  const value = { op: 'LIKE' as const, val: '1%' };
  expect(getConditionError(value, GenericDataType.String)).toBeNull();
  expect(getConditionError(value, GenericDataType.Numeric)).toBe(
    'LIKE is not supported for this column type',
  );
  expect(
    getConditionExtraFormData('price', value, GenericDataType.Numeric),
  ).toEqual({});
});

test('numeric columns reject non-numeric values', () => {
  expect(
    getConditionError({ op: '>', val: 'abc' }, GenericDataType.Numeric),
  ).toBe('This column is numeric. Please enter a number.');
  expect(
    getConditionError({ op: 'IN', val: ['1', 'x'] }, GenericDataType.Numeric),
  ).not.toBeNull();
  expect(
    getConditionError({ op: 'IN', val: ['1', 2] }, GenericDataType.Numeric),
  ).toBeNull();
  expect(
    getConditionError({ op: 'IS NULL' }, GenericDataType.Numeric),
  ).toBeNull();
});

test('numeric columns reject values that overflow to Infinity', () => {
  expect(
    getConditionError({ op: '>', val: '1e309' }, GenericDataType.Numeric),
  ).toBe('This column is numeric. Please enter a number.');
  expect(
    getConditionExtraFormData(
      'price',
      { op: '>', val: '1e309' },
      GenericDataType.Numeric,
    ),
  ).toEqual({});
  expect(coerceConditionValue('1e309', '>', GenericDataType.Numeric)).toBe(
    '1e309',
  );
});

test('boolean columns cast typed true/false', () => {
  expect(coerceConditionValue('TRUE', '==', GenericDataType.Boolean)).toBe(
    true,
  );
  expect(coerceConditionValue('false', '!=', GenericDataType.Boolean)).toBe(
    false,
  );
  expect(coerceConditionValue('yes', '==', GenericDataType.Boolean)).toBe(
    'yes',
  );
});
