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
import { getTimeFormatter } from '@superset-ui/core';
import {
  formatBubbleValue,
  getBubbleCrossFilterDataMask,
  getBubbleCrossFilterKey,
  getSelectedBubbleKeys,
} from '../../src/Bubble/crossFilter';

test('getSelectedBubbleKeys reads the array form', () => {
  expect(getSelectedBubbleKeys(['["a"]', '["b"]'])).toEqual(['["a"]', '["b"]']);
});

test('getSelectedBubbleKeys reads the object form', () => {
  expect(getSelectedBubbleKeys({ 0: '["a"]', 1: '["b"]' })).toEqual([
    '["a"]',
    '["b"]',
  ]);
});

test('getSelectedBubbleKeys returns an empty list for empty input', () => {
  expect(getSelectedBubbleKeys(null)).toEqual([]);
  expect(getSelectedBubbleKeys(undefined)).toEqual([]);
  expect(getSelectedBubbleKeys('a')).toEqual([]);
});

test('getBubbleCrossFilterKey distinguishes null, empty string, and "null"', () => {
  const keys = [null, '', 'null'].map(value =>
    getBubbleCrossFilterKey(value, undefined, false),
  );

  expect(new Set(keys).size).toBe(3);
});

test('getBubbleCrossFilterKey distinguishes numbers from strings', () => {
  expect(getBubbleCrossFilterKey(1, undefined, false)).not.toBe(
    getBubbleCrossFilterKey('1', undefined, false),
  );
});

test('getBubbleCrossFilterKey keeps entity and series unambiguous', () => {
  expect(getBubbleCrossFilterKey('a,b', 'c', true)).not.toBe(
    getBubbleCrossFilterKey('a', 'b,c', true),
  );
});

test('getBubbleCrossFilterKey serializes bigint and Date values', () => {
  expect(getBubbleCrossFilterKey(BigInt(10), undefined, false)).toBe('["10"]');
  expect(
    getBubbleCrossFilterKey(
      new Date('2024-01-02T03:04:05.000Z'),
      undefined,
      false,
    ),
  ).toBe('["2024-01-02T03:04:05.000Z"]');
});

test('getBubbleCrossFilterDataMask formats a temporal entity on the chip', () => {
  const epoch = Date.parse('2024-01-02T00:00:00.000Z');
  const { dataMask } = getBubbleCrossFilterDataMask({
    entity: 'order_date',
    datum: [1, 2, 3, epoch, null],
    selectedKeys: [],
    coltypeMapping: { order_date: GenericDataType.Temporal },
    dateFormat: '%Y-%m-%d',
  });
  const label = getTimeFormatter('%Y-%m-%d')(new Date(epoch));

  expect(dataMask.filterState.label).toBe(label);
  expect(dataMask.filterState.label).not.toBe(String(epoch));
  expect(dataMask.extraFormData.filters).toEqual([
    { col: 'order_date', op: 'IN', val: [epoch] },
  ]);
});

test('getBubbleCrossFilterDataMask keeps a numeric entity unabbreviated', () => {
  const { dataMask } = getBubbleCrossFilterDataMask({
    entity: 'customer_id',
    series: 'year',
    datum: [1, 2, 3, 12345, 2024],
    selectedKeys: [],
  });

  expect(dataMask.filterState.label).toBe('12345, 2024');
  expect(dataMask.extraFormData.filters).toEqual([
    { col: 'customer_id', op: 'IN', val: [12345] },
    { col: 'year', op: 'IN', val: [2024] },
  ]);
});

test('getBubbleCrossFilterDataMask stores bigint as a JSON-safe string', () => {
  const { dataMask } = getBubbleCrossFilterDataMask({
    entity: 'customer_name',
    series: 'status',
    datum: [1, 2, 3, BigInt(10), BigInt(20)],
    selectedKeys: [],
  });

  expect(dataMask.extraFormData.filters).toEqual([
    { col: 'customer_name', op: 'IN', val: ['10'] },
    { col: 'status', op: 'IN', val: ['20'] },
  ]);
  expect(JSON.stringify(dataMask)).toContain('"10"');
});

test('formatBubbleValue formats null and empty string distinctly', () => {
  expect(formatBubbleValue(null)).toBe('<NULL>');
  expect(formatBubbleValue('')).toBe('<empty string>');
  expect(formatBubbleValue(0)).toBe('0');
  expect(formatBubbleValue(false)).toBe('false');
});
