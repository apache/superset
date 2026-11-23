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
  EMPTY_STRING,
  formatHeatmapValue,
  getHeatmapCrossFilterDataMask,
  getSelectedHeatmapKeys,
  heatmapCellKey,
  heatmapValueId,
  toJsonSafeFilterValue,
} from '../../src/Heatmap/crossFilter';

describe('heatmapValueId', () => {
  test('handles null and undefined', () => {
    expect(heatmapValueId(null)).toBe('null');
    expect(heatmapValueId(undefined)).toBe('null');
  });

  test('distinguishes empty string from null and "null"', () => {
    expect(heatmapValueId('')).toBe('""');
    expect(heatmapValueId(null)).toBe('null');
    expect(heatmapValueId('null')).toBe('"null"');
    expect(
      new Set([
        heatmapValueId(''),
        heatmapValueId(null),
        heatmapValueId('null'),
      ]).size,
    ).toBe(3);
  });

  test('distinguishes number from numeric string', () => {
    expect(heatmapValueId(42)).toBe('42');
    expect(heatmapValueId('42')).toBe('"42"');
    expect(heatmapValueId(42)).not.toBe(heatmapValueId('42'));
  });

  test('handles bigint without throwing', () => {
    expect(heatmapValueId(42n)).toBe(JSON.stringify({ bigint: '42' }));
  });

  test('handles Date objects', () => {
    const d = new Date('2024-01-01T00:00:00.000Z');
    expect(heatmapValueId(d)).toBe(
      JSON.stringify({ date: '2024-01-01T00:00:00.000Z' }),
    );
  });
});

describe('heatmapCellKey', () => {
  test('is unique per cell coordinate pair and stable', () => {
    const key1 = heatmapCellKey('Monday', 9);
    const key2 = heatmapCellKey('Monday', 10);
    const key3 = heatmapCellKey('Tuesday', 9);
    const key1Repeat = heatmapCellKey('Monday', 9);

    expect(key1).toBe(key1Repeat);
    expect(key1).not.toBe(key2);
    expect(key1).not.toBe(key3);
    expect(key2).not.toBe(key3);
  });

  test('distinguishes string and number in coordinates', () => {
    expect(heatmapCellKey('42', 1)).not.toBe(heatmapCellKey(42, 1));
    expect(heatmapCellKey('a', '42')).not.toBe(heatmapCellKey('a', 42));
  });
});

describe('getSelectedHeatmapKeys', () => {
  test('reads array form', () => {
    expect(getSelectedHeatmapKeys(['["cell","1","2"]'])).toEqual([
      '["cell","1","2"]',
    ]);
  });

  test('reads object form', () => {
    expect(
      getSelectedHeatmapKeys({ 0: '["cell","1","2"]', 1: '["cell","3","4"]' }),
    ).toEqual(['["cell","1","2"]', '["cell","3","4"]']);
  });

  test('returns empty array for null, undefined, and non-object inputs', () => {
    expect(getSelectedHeatmapKeys(null)).toEqual([]);
    expect(getSelectedHeatmapKeys(undefined)).toEqual([]);
    expect(getSelectedHeatmapKeys(42)).toEqual([]);
    expect(getSelectedHeatmapKeys('string')).toEqual([]);
  });
});

describe('toJsonSafeFilterValue', () => {
  test('converts bigint to string and keeps other primitives unchanged', () => {
    expect(toJsonSafeFilterValue(42n)).toBe('42');
    expect(toJsonSafeFilterValue(42)).toBe(42);
    expect(toJsonSafeFilterValue('test')).toBe('test');
    expect(toJsonSafeFilterValue(true)).toBe(true);
  });
});

describe('formatHeatmapValue', () => {
  test('formats null, undefined, and empty string distinctly', () => {
    expect(formatHeatmapValue(null)).toBe('<NULL>');
    expect(formatHeatmapValue(undefined)).toBe('<NULL>');
    expect(formatHeatmapValue('')).toBe(EMPTY_STRING);
  });

  test('formats numbers and strings', () => {
    expect(formatHeatmapValue('Monday')).toBe('Monday');
    expect(formatHeatmapValue(42)).toBe('42');
  });

  test('formats temporal columns using timeFormatter', () => {
    const epoch = Date.parse('2024-01-02T00:00:00.000Z');
    const formatted = formatHeatmapValue(epoch, 'order_date', {
      order_date: GenericDataType.Temporal,
    });
    const expected = getTimeFormatter()(new Date(epoch));
    expect(formatted).toBe(expected);
  });
});

describe('getHeatmapCrossFilterDataMask', () => {
  test('initial click emits IN filters for x and y, composite key in selectedValues, and label', () => {
    const result = getHeatmapCrossFilterDataMask({
      xColumn: 'day_of_week',
      yColumn: 'hour',
      xValue: 'Monday',
      yValue: 9,
      selectedKeys: [],
    });

    const expectedKey = heatmapCellKey('Monday', 9);
    expect(result.isCurrentValueSelected).toBe(false);
    expect(result.dataMask).toEqual({
      extraFormData: {
        filters: [
          { col: 'day_of_week', op: 'IN', val: ['Monday'] },
          { col: 'hour', op: 'IN', val: [9] },
        ],
      },
      filterState: {
        label: 'Monday (9)',
        value: 'Monday (9)',
        selectedValues: [expectedKey],
      },
    });
  });

  test('second click on same cell clears filters and selection', () => {
    const key = heatmapCellKey('Monday', 9);
    const result = getHeatmapCrossFilterDataMask({
      xColumn: 'day_of_week',
      yColumn: 'hour',
      xValue: 'Monday',
      yValue: 9,
      selectedKeys: [key],
    });

    expect(result.isCurrentValueSelected).toBe(true);
    expect(result.dataMask).toEqual({
      extraFormData: {
        filters: [],
      },
      filterState: {
        label: null,
        value: null,
        selectedValues: null,
      },
    });
  });

  test('click on another cell replaces existing selection', () => {
    const existingKey = heatmapCellKey('Monday', 9);
    const result = getHeatmapCrossFilterDataMask({
      xColumn: 'day_of_week',
      yColumn: 'hour',
      xValue: 'Tuesday',
      yValue: 14,
      selectedKeys: [existingKey],
    });

    const newKey = heatmapCellKey('Tuesday', 14);
    expect(result.isCurrentValueSelected).toBe(false);
    expect(result.dataMask).toEqual({
      extraFormData: {
        filters: [
          { col: 'day_of_week', op: 'IN', val: ['Tuesday'] },
          { col: 'hour', op: 'IN', val: [14] },
        ],
      },
      filterState: {
        label: 'Tuesday (14)',
        value: 'Tuesday (14)',
        selectedValues: [newKey],
      },
    });
  });

  test('null value emits IS NULL clause', () => {
    const result = getHeatmapCrossFilterDataMask({
      xColumn: 'day_of_week',
      yColumn: 'hour',
      xValue: null,
      yValue: 9,
      selectedKeys: [],
    });

    expect(result.dataMask.extraFormData.filters).toEqual([
      { col: 'day_of_week', op: 'IS NULL' },
      { col: 'hour', op: 'IN', val: [9] },
    ]);
    expect(result.dataMask.filterState.label).toBe('<NULL> (9)');
  });

  test('bigint value is serialized to string in IN filter and JSON stringify safe', () => {
    const result = getHeatmapCrossFilterDataMask({
      xColumn: 'entity_id',
      yColumn: 'hour',
      xValue: 1234567890123456789n,
      yValue: 9,
      selectedKeys: [],
    });

    expect(result.dataMask.extraFormData.filters).toEqual([
      { col: 'entity_id', op: 'IN', val: ['1234567890123456789'] },
      { col: 'hour', op: 'IN', val: [9] },
    ]);
    expect(() => JSON.stringify(result.dataMask)).not.toThrow();
  });

  test('duplicate x and y column and value emits deduplicated filter clause', () => {
    const result = getHeatmapCrossFilterDataMask({
      xColumn: 'category',
      yColumn: 'category',
      xValue: 'A',
      yValue: 'A',
      selectedKeys: [],
    });

    expect(result.dataMask.extraFormData.filters).toEqual([
      { col: 'category', op: 'IN', val: ['A'] },
    ]);
    expect(result.dataMask.filterState.label).toBe('A (A)');
  });

  test('handles groupby passed as an array of columns', () => {
    const result = getHeatmapCrossFilterDataMask({
      xColumn: 'day_of_week',
      yColumn: ['hour'],
      xValue: 'Friday',
      yValue: 16,
      selectedKeys: [],
    });

    expect(result.dataMask.extraFormData.filters).toEqual([
      { col: 'day_of_week', op: 'IN', val: ['Friday'] },
      { col: 'hour', op: 'IN', val: [16] },
    ]);
    expect(result.dataMask.filterState.label).toBe('Friday (16)');
  });
});
