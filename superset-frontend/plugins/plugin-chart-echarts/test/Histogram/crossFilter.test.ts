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
import {
  HistogramBin,
  getHistogramCrossFilterDataMask,
  getHistogramCrossFilterKey,
  getSelectedHistogramKeys,
  parseBinKey,
} from '../../src/Histogram/crossFilter';

const bin = (start: number, end: number, isLast = false): HistogramBin => ({
  start,
  end,
  isLast,
  label: `${start} - ${end}`,
});

test('parseBinKey keeps a negative left edge', () => {
  expect(parseBinKey('-1.5 - 0.5')).toEqual({ start: -1.5, end: 0.5 });
  expect(parseBinKey('region')).toBeUndefined();
});

test('getSelectedHistogramKeys reads array and object forms', () => {
  expect(getSelectedHistogramKeys(['[0,5]'])).toEqual(['[0,5]']);
  expect(getSelectedHistogramKeys({ 0: '[0,5]' })).toEqual(['[0,5]']);
  expect(getSelectedHistogramKeys(null)).toEqual([]);
});

test('getHistogramCrossFilterDataMask filters a bin with a half-open range', () => {
  const { dataMask } = getHistogramCrossFilterDataMask({
    column: 'price',
    groupby: [],
    bin: bin(0, 5),
    groupbyValues: [],
    selectedKeys: [],
  });

  expect(dataMask.extraFormData.filters).toEqual([
    { col: 'price', op: '>=', val: 0 },
    { col: 'price', op: '<', val: 5 },
  ]);
  expect(dataMask.filterState.label).toBe('0 - 5');
  expect(dataMask.filterState.selectedValues).toEqual([
    getHistogramCrossFilterKey(bin(0, 5), []),
  ]);
});

test('a cumulative bin filter drops the lower bound', () => {
  const earlier = getHistogramCrossFilterDataMask({
    column: 'price',
    groupby: [],
    bin: bin(5, 10),
    groupbyValues: [],
    selectedKeys: [],
    cumulative: true,
  }).dataMask;
  expect(earlier.extraFormData.filters).toEqual([
    { col: 'price', op: '<', val: 10 },
  ]);
  expect(earlier.filterState.label).toBe('< 10');

  const last = getHistogramCrossFilterDataMask({
    column: 'price',
    groupby: ['region'],
    bin: bin(10, 15, true),
    groupbyValues: ['WEST'],
    selectedKeys: [],
    cumulative: true,
  }).dataMask;
  expect(last.extraFormData.filters).toEqual([
    { col: 'price', op: '<=', val: 15 },
    { col: 'region', op: 'IN', val: ['WEST'] },
  ]);
  expect(last.filterState.label).toBe('<= 15, WEST');
});

test('getHistogramCrossFilterDataMask includes the right edge of the last bin', () => {
  const { dataMask } = getHistogramCrossFilterDataMask({
    column: 'price',
    groupby: [],
    bin: bin(5, 10, true),
    groupbyValues: [],
    selectedKeys: [],
  });

  expect(dataMask.extraFormData.filters).toEqual([
    { col: 'price', op: '>=', val: 5 },
    { col: 'price', op: '<=', val: 10 },
  ]);
});

test('getHistogramCrossFilterDataMask clears the filter when the bin is selected', () => {
  const selected = getHistogramCrossFilterKey(bin(0, 5), []);
  const { dataMask } = getHistogramCrossFilterDataMask({
    column: 'price',
    groupby: [],
    bin: bin(0, 5),
    groupbyValues: [],
    selectedKeys: [selected],
  });

  expect(dataMask.extraFormData.filters).toEqual([]);
  expect(dataMask.filterState).toEqual({
    label: null,
    value: null,
    selectedValues: null,
  });
});

test('getHistogramCrossFilterDataMask filters groupby and keeps numeric labels full', () => {
  const { dataMask } = getHistogramCrossFilterDataMask({
    column: 'price',
    groupby: ['region', 'year'],
    bin: bin(0, 5),
    groupbyValues: ['WEST', 2024],
    selectedKeys: [],
  });

  expect(dataMask.extraFormData.filters).toEqual([
    { col: 'price', op: '>=', val: 0 },
    { col: 'price', op: '<', val: 5 },
    { col: 'region', op: 'IN', val: ['WEST'] },
    { col: 'year', op: 'IN', val: [2024] },
  ]);
  expect(dataMask.filterState.label).toBe('0 - 5, WEST, 2024');
});

test('getHistogramCrossFilterDataMask uses IS NULL for an empty group', () => {
  const { dataMask } = getHistogramCrossFilterDataMask({
    column: 'price',
    groupby: ['region'],
    bin: bin(0, 5),
    groupbyValues: [null],
    selectedKeys: [],
  });

  expect(dataMask.extraFormData.filters).toContainEqual({
    col: 'region',
    op: 'IS NULL',
  });
  expect(dataMask.filterState.label).toBe('0 - 5, <NULL>');
});

test('getHistogramCrossFilterDataMask stores bigint group values as strings', () => {
  const { dataMask } = getHistogramCrossFilterDataMask({
    column: 'price',
    groupby: ['id'],
    bin: bin(0, 5),
    groupbyValues: [BigInt(10)],
    selectedKeys: [],
  });

  expect(dataMask.extraFormData.filters).toContainEqual({
    col: 'id',
    op: 'IN',
    val: ['10'],
  });
  expect(() => JSON.stringify(dataMask)).not.toThrow();
});
