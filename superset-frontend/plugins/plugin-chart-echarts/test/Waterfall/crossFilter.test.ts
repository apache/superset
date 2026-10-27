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
import { getTimeFormatter, TimeGranularity } from '@superset-ui/core';
import {
  getSelectedWaterfallKeys,
  getWaterfallCrossFilterDataMask,
  getWaterfallCrossFilterKey,
  getWaterfallDrillByXAxisFilter,
  getWaterfallDrillFilters,
  isWaterfallBarDimmed,
  WaterfallCategory,
} from '../../src/Waterfall/crossFilter';

const yearBar: WaterfallCategory = {
  isGrandTotal: false,
  xOnly: true,
  xColumn: 'year',
  xValue: 2019,
};

const breakdownBar: WaterfallCategory = {
  isGrandTotal: false,
  xOnly: false,
  xColumn: 'year',
  xValue: 2019,
  breakdownColumn: 'name',
  breakdownValue: 'Sylvester',
};

const periodTotal: WaterfallCategory = {
  isGrandTotal: false,
  xOnly: true,
  xColumn: 'year',
  xValue: 2019,
  breakdownColumn: 'name',
};

const grandTotal: WaterfallCategory = {
  isGrandTotal: true,
  xOnly: true,
  xColumn: 'year',
  xValue: null,
};

test('builds an X-only key and an X plus breakdown key', () => {
  expect(getWaterfallCrossFilterKey(yearBar)).toBe(JSON.stringify([2019]));
  expect(getWaterfallCrossFilterKey(breakdownBar)).toBe(
    JSON.stringify([2019, 'Sylvester']),
  );
  expect(getWaterfallCrossFilterKey(grandTotal)).toBeNull();
});

test('filters the X column for a chart without a breakdown', () => {
  const { dataMask } = getWaterfallCrossFilterDataMask({
    category: yearBar,
    selectedKeys: [],
  });
  expect(dataMask.extraFormData.filters).toEqual([
    { col: 'year', op: 'IN', val: [2019] },
  ]);
  expect(dataMask.filterState.label).toBe('2019');
  expect(dataMask.filterState.selectedValues).toEqual([JSON.stringify([2019])]);
});

test('filters both the X column and the breakdown', () => {
  const { dataMask } = getWaterfallCrossFilterDataMask({
    category: breakdownBar,
    selectedKeys: [],
  });
  expect(dataMask.extraFormData.filters).toEqual([
    { col: 'year', op: 'IN', val: [2019] },
    { col: 'name', op: 'IN', val: ['Sylvester'] },
  ]);
  expect(dataMask.filterState.label).toBe('2019, Sylvester');
});

test('a period total filters the X column only', () => {
  const { dataMask } = getWaterfallCrossFilterDataMask({
    category: periodTotal,
    selectedKeys: [],
  });
  expect(dataMask.extraFormData.filters).toEqual([
    { col: 'year', op: 'IN', val: [2019] },
  ]);
});

test('clicking the same bar again clears the filter', () => {
  const key = getWaterfallCrossFilterKey(yearBar)!;
  const { dataMask } = getWaterfallCrossFilterDataMask({
    category: yearBar,
    selectedKeys: [key],
  });
  expect(dataMask.extraFormData.filters).toEqual([]);
  expect(dataMask.filterState.selectedValues).toBeNull();
});

test('a grand total produces no filter', () => {
  const { dataMask } = getWaterfallCrossFilterDataMask({
    category: grandTotal,
    selectedKeys: [],
  });
  expect(dataMask.extraFormData.filters).toEqual([]);
  expect(dataMask.filterState.selectedValues).toBeNull();
});

test('null and empty breakdown values stay distinct', () => {
  const nullBar: WaterfallCategory = {
    ...breakdownBar,
    breakdownValue: null,
  };
  const emptyBar: WaterfallCategory = {
    ...breakdownBar,
    breakdownValue: '',
  };
  expect(
    getWaterfallCrossFilterDataMask({
      category: nullBar,
      selectedKeys: [],
    }).dataMask.extraFormData.filters,
  ).toEqual([
    { col: 'year', op: 'IN', val: [2019] },
    { col: 'name', op: 'IS NULL' },
  ]);
  const emptyMask = getWaterfallCrossFilterDataMask({
    category: emptyBar,
    selectedKeys: [],
  }).dataMask;
  expect(emptyMask.extraFormData.filters).toEqual([
    { col: 'year', op: 'IN', val: [2019] },
    { col: 'name', op: 'IN', val: [''] },
  ]);
  expect(emptyMask.filterState.label).toBe('2019, <empty string>');
});

test('keeps a numeric category unabbreviated', () => {
  const mask = getWaterfallCrossFilterDataMask({
    category: { ...yearBar, xValue: 2024 },
    selectedKeys: [],
  }).dataMask;
  expect(mask.filterState.label).toBe('2024');
});

test('a bigint category does not share a selection key with the same decimal string', () => {
  const bigintBar: WaterfallCategory = { ...yearBar, xValue: BigInt(42) };
  const stringBar: WaterfallCategory = { ...yearBar, xValue: '42' };
  const bigintKey = getWaterfallCrossFilterKey(bigintBar);
  const stringKey = getWaterfallCrossFilterKey(stringBar);

  expect(bigintKey).not.toBe(stringKey);

  const mask = getWaterfallCrossFilterDataMask({
    category: bigintBar,
    selectedKeys: [],
  }).dataMask;
  expect(mask.extraFormData.filters).toEqual([
    { col: 'year', op: 'IN', val: ['42'] },
  ]);
  expect(mask.filterState.selectedValues).toEqual([bigintKey]);
  expect(() => JSON.stringify(mask)).not.toThrow();

  const stringMask = getWaterfallCrossFilterDataMask({
    category: stringBar,
    selectedKeys: bigintKey ? [bigintKey] : [],
  }).dataMask;
  expect(stringMask.extraFormData.filters).not.toEqual([]);
  expect(isWaterfallBarDimmed(stringBar, bigintKey ? [bigintKey] : [])).toBe(
    true,
  );
  expect(isWaterfallBarDimmed(bigintBar, bigintKey ? [bigintKey] : [])).toBe(
    false,
  );
});

test('formats a temporal X value with the axis time format', () => {
  const epoch = Date.parse('2020-01-15T00:00:00.000Z');
  const mask = getWaterfallCrossFilterDataMask({
    category: {
      ...yearBar,
      xValue: epoch,
    },
    selectedKeys: [],
    coltypeMapping: { year: GenericDataType.Temporal },
    timeFormat: '%Y-%m-%d',
  }).dataMask;
  expect(mask.filterState.label).toBe(
    getTimeFormatter('%Y-%m-%d')(new Date(epoch)),
  );
});

test('reads selected keys from an array or an object', () => {
  expect(getSelectedWaterfallKeys(['a'])).toEqual(['a']);
  expect(getSelectedWaterfallKeys({ 0: 'a' })).toEqual(['a']);
  expect(getSelectedWaterfallKeys(undefined)).toEqual([]);
});

test('an X-only selection keeps every bar of that period bright', () => {
  const selected = [JSON.stringify([2019])];
  expect(isWaterfallBarDimmed(yearBar, selected)).toBe(false);
  expect(isWaterfallBarDimmed(breakdownBar, selected)).toBe(false);
  expect(isWaterfallBarDimmed(periodTotal, selected)).toBe(false);
  expect(isWaterfallBarDimmed({ ...yearBar, xValue: 2020 }, selected)).toBe(
    true,
  );
  expect(isWaterfallBarDimmed(grandTotal, selected)).toBe(true);
  expect(isWaterfallBarDimmed(grandTotal, [])).toBe(false);
});

test('a breakdown selection keeps only that bar bright', () => {
  const selected = [JSON.stringify([2019, 'Sylvester'])];
  const arnold: WaterfallCategory = {
    ...breakdownBar,
    breakdownValue: 'Arnold',
  };
  expect(isWaterfallBarDimmed(breakdownBar, selected)).toBe(false);
  expect(isWaterfallBarDimmed(arnold, selected)).toBe(true);
  expect(isWaterfallBarDimmed(periodTotal, selected)).toBe(true);
});

test('a temporal X axis with a time grain filters the whole bucket', () => {
  const orderDate = '2021-01-01T00:00:00';
  const range = '2021-01-01T00:00:00 : 2021-02-01T00:00:00';
  const formattedVal = getTimeFormatter('%Y-%m-%d')(new Date(`${orderDate}Z`));
  const category: WaterfallCategory = {
    ...breakdownBar,
    xColumn: 'order_date',
    xValue: orderDate,
  };
  const context = {
    category,
    coltypeMapping: { order_date: GenericDataType.Temporal },
    timeFormat: '%Y-%m-%d',
    timeGrain: TimeGranularity.MONTH,
  };
  const mask = getWaterfallCrossFilterDataMask({
    ...context,
    selectedKeys: [],
  }).dataMask;
  expect(mask.extraFormData).toEqual({
    filters: [
      {
        col: 'order_date',
        op: 'TEMPORAL_RANGE',
        val: range,
        formattedVal,
      },
      { col: 'name', op: 'IN', val: ['Sylvester'] },
    ],
    time_range: range,
  });
  expect(
    getWaterfallDrillFilters(context).find(
      filter => filter.col === 'order_date',
    ),
  ).toEqual({
    col: 'order_date',
    op: '==',
    val: orderDate,
    formattedVal,
    grain: TimeGranularity.MONTH,
  });
  expect(getWaterfallDrillByXAxisFilter(context)).toEqual({
    col: 'order_date',
    op: 'TEMPORAL_RANGE',
    val: range,
    formattedVal,
  });
});

test('a temporal X axis without a grain stays an exact match', () => {
  const mask = getWaterfallCrossFilterDataMask({
    category: { ...yearBar, xValue: '2021-01-10T00:00:00' },
    selectedKeys: [],
    coltypeMapping: { year: GenericDataType.Temporal },
  }).dataMask;
  expect(mask.extraFormData.filters).toEqual([
    { col: 'year', op: 'IN', val: ['2021-01-10T00:00:00'] },
  ]);
  expect(mask.extraFormData.time_range).toBeUndefined();
});

test('a time grain does not bucket a non-temporal X axis', () => {
  const mask = getWaterfallCrossFilterDataMask({
    category: yearBar,
    selectedKeys: [],
    timeGrain: TimeGranularity.MONTH,
  }).dataMask;
  expect(mask.extraFormData.filters).toEqual([
    { col: 'year', op: 'IN', val: [2019] },
  ]);
});

test('drill filters use equality and split the breakdown from the X axis', () => {
  expect(getWaterfallDrillFilters({ category: breakdownBar })).toEqual([
    { col: 'year', op: '==', val: 2019, formattedVal: '2019' },
    { col: 'name', op: '==', val: 'Sylvester', formattedVal: 'Sylvester' },
  ]);
  expect(getWaterfallDrillFilters({ category: grandTotal })).toEqual([]);
  expect(
    getWaterfallDrillFilters({
      category: { ...breakdownBar, breakdownValue: null },
    }),
  ).toEqual([
    { col: 'year', op: '==', val: 2019, formattedVal: '2019' },
    { col: 'name', op: 'IS NULL', formattedVal: '<NULL>' },
  ]);
});
