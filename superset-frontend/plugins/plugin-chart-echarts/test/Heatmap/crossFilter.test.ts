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
  DTTM_ALIAS,
  getTimeFormatter,
  TimeGranularity,
} from '@superset-ui/core';
import {
  EMPTY_STRING,
  formatHeatmapValue,
  getHeatmapCrossFilterDataMask,
  getHeatmapDrillByFilters,
  getHeatmapDrillFilters,
  getSelectedHeatmapKeys,
  heatmapCellKey,
  heatmapValueId,
  isTemporalColumn,
  resolveColumn,
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

describe('resolveColumn', () => {
  test('returns col if col is undefined', () => {
    expect(resolveColumn(undefined, 'ds')).toBeUndefined();
  });

  test('returns col when col is not DTTM_ALIAS', () => {
    expect(resolveColumn('country', 'ds')).toBe('country');
  });

  test('resolves DTTM_ALIAS to granularitySqla when provided', () => {
    expect(resolveColumn(DTTM_ALIAS, 'ds')).toBe('ds');
  });

  test('returns DTTM_ALIAS when granularitySqla is undefined', () => {
    expect(resolveColumn(DTTM_ALIAS, undefined)).toBe(DTTM_ALIAS);
  });

  test('handles ad-hoc column object', () => {
    const colObj = {
      label: 'my_col',
      sqlExpression: 'my_col',
      expressionType: 'SQL' as const,
    };
    expect(resolveColumn(colObj, 'ds')).toBe(colObj);

    const dttmObj = {
      label: DTTM_ALIAS,
      sqlExpression: '__timestamp',
      expressionType: 'SQL' as const,
    };
    expect(resolveColumn(dttmObj, 'ds')).toBe('ds');
  });
});

describe('isTemporalColumn', () => {
  test('returns false for undefined column', () => {
    expect(isTemporalColumn(undefined)).toBe(false);
  });

  test('returns true for DTTM_ALIAS', () => {
    expect(isTemporalColumn(DTTM_ALIAS)).toBe(true);
    expect(
      isTemporalColumn({
        label: DTTM_ALIAS,
        sqlExpression: '__timestamp',
        expressionType: 'SQL' as const,
      }),
    ).toBe(true);
  });

  test('returns true when coltypeMapping maps column to GenericDataType.Temporal', () => {
    expect(
      isTemporalColumn('order_date', {
        order_date: GenericDataType.Temporal,
      }),
    ).toBe(true);
  });

  test('returns true when granularitySqla matches column name or is in coltypeMapping', () => {
    expect(isTemporalColumn('ds', {}, 'ds')).toBe(true);
    expect(
      isTemporalColumn('other_col', { ds: GenericDataType.Temporal }, 'ds'),
    ).toBe(true);
  });

  test('returns false for categorical or numeric columns', () => {
    expect(
      isTemporalColumn('country', {
        country: GenericDataType.String,
      }),
    ).toBe(false);
    expect(
      isTemporalColumn('count', {
        count: GenericDataType.Numeric,
      }),
    ).toBe(false);
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

  test('formats temporal columns using timeFormatter with timeGrain', () => {
    const epoch = Date.parse('2024-01-02T00:00:00.000Z');
    const formatted = formatHeatmapValue(
      epoch,
      'order_date',
      { order_date: GenericDataType.Temporal },
      TimeGranularity.MONTH,
    );
    const expected = getTimeFormatter(
      undefined,
      TimeGranularity.MONTH,
    )(new Date(epoch));
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

  test('null value on temporal axis emits IS NULL clause', () => {
    const result = getHeatmapCrossFilterDataMask({
      xColumn: 'order_date',
      yColumn: 'hour',
      xValue: null,
      yValue: 9,
      selectedKeys: [],
      coltypeMapping: { order_date: GenericDataType.Temporal },
      timeGrain: TimeGranularity.MONTH,
    });

    expect(result.dataMask.extraFormData.filters).toEqual([
      { col: 'order_date', op: 'IS NULL' },
      { col: 'hour', op: 'IN', val: [9] },
    ]);
    expect(result.dataMask.extraFormData).not.toHaveProperty('time_range');
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

  test('cross-filter on temporal axis with timeGrain emits TEMPORAL_RANGE and sets extraFormData.time_range', () => {
    const result = getHeatmapCrossFilterDataMask({
      xColumn: 'order_date',
      yColumn: 'channel',
      xValue: '2024-01-01T00:00:00',
      yValue: 'web',
      selectedKeys: [],
      coltypeMapping: { order_date: GenericDataType.Temporal },
      timeGrain: TimeGranularity.MONTH,
    });

    const expectedRange = '2024-01-01T00:00:00 : 2024-02-01T00:00:00';
    const expectedKey = heatmapCellKey('2024-01-01T00:00:00', 'web');
    expect(result.dataMask).toEqual({
      extraFormData: {
        filters: [
          { col: 'order_date', op: 'TEMPORAL_RANGE', val: expectedRange },
          { col: 'channel', op: 'IN', val: ['web'] },
        ],
        time_range: expectedRange,
      },
      filterState: {
        label: expect.any(String),
        value: expect.any(String),
        selectedValues: [expectedKey],
      },
    });
  });

  test('cross-filter toggle on temporal axis clears filter and time_range', () => {
    const key = heatmapCellKey('2024-01-01T00:00:00', 'web');
    const result = getHeatmapCrossFilterDataMask({
      xColumn: 'order_date',
      yColumn: 'channel',
      xValue: '2024-01-01T00:00:00',
      yValue: 'web',
      selectedKeys: [key],
      coltypeMapping: { order_date: GenericDataType.Temporal },
      timeGrain: TimeGranularity.MONTH,
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
    expect(result.dataMask.extraFormData).not.toHaveProperty('time_range');
  });

  test('cross-filter on temporal axis without timeGrain falls back to op: IN and does not set time_range', () => {
    const result = getHeatmapCrossFilterDataMask({
      xColumn: 'order_date',
      yColumn: 'channel',
      xValue: '2024-01-01T00:00:00',
      yValue: 'web',
      selectedKeys: [],
      coltypeMapping: { order_date: GenericDataType.Temporal },
    });

    expect(result.dataMask.extraFormData).toEqual({
      filters: [
        { col: 'order_date', op: 'IN', val: ['2024-01-01T00:00:00'] },
        { col: 'channel', op: 'IN', val: ['web'] },
      ],
    });
    expect(result.dataMask.extraFormData).not.toHaveProperty('time_range');
  });

  test('cross-filter on DTTM_ALIAS resolves to granularitySqla', () => {
    const result = getHeatmapCrossFilterDataMask({
      xColumn: DTTM_ALIAS,
      yColumn: 'channel',
      xValue: '2024-01-01T00:00:00',
      yValue: 'web',
      selectedKeys: [],
      granularitySqla: 'order_date',
      timeGrain: TimeGranularity.MONTH,
    });

    const expectedRange = '2024-01-01T00:00:00 : 2024-02-01T00:00:00';
    expect(result.dataMask.extraFormData.filters).toEqual([
      { col: 'order_date', op: 'TEMPORAL_RANGE', val: expectedRange },
      { col: 'channel', op: 'IN', val: ['web'] },
    ]);
    expect(result.dataMask.extraFormData.time_range).toBe(expectedRange);
  });

  test('mixed temporal X and categorical Y emits TEMPORAL_RANGE for X, IN for Y, and sets time_range', () => {
    const result = getHeatmapCrossFilterDataMask({
      xColumn: 'order_date',
      yColumn: 'device',
      xValue: '2024-01-01T00:00:00',
      yValue: 'mobile',
      selectedKeys: [],
      coltypeMapping: {
        order_date: GenericDataType.Temporal,
        device: GenericDataType.String,
      },
      timeGrain: TimeGranularity.DAY,
    });

    const expectedRange = '2024-01-01T00:00:00 : 2024-01-02T00:00:00';
    expect(result.dataMask.extraFormData.filters).toEqual([
      { col: 'order_date', op: 'TEMPORAL_RANGE', val: expectedRange },
      { col: 'device', op: 'IN', val: ['mobile'] },
    ]);
    expect(result.dataMask.extraFormData.time_range).toBe(expectedRange);
  });

  test('mixed categorical X and temporal Y emits IN for X, TEMPORAL_RANGE for Y, and sets time_range', () => {
    const result = getHeatmapCrossFilterDataMask({
      xColumn: 'device',
      yColumn: 'order_date',
      xValue: 'mobile',
      yValue: '2024-01-01T00:00:00',
      selectedKeys: [],
      coltypeMapping: {
        order_date: GenericDataType.Temporal,
        device: GenericDataType.String,
      },
      timeGrain: TimeGranularity.DAY,
    });

    const expectedRange = '2024-01-01T00:00:00 : 2024-01-02T00:00:00';
    expect(result.dataMask.extraFormData.filters).toEqual([
      { col: 'device', op: 'IN', val: ['mobile'] },
      { col: 'order_date', op: 'TEMPORAL_RANGE', val: expectedRange },
    ]);
    expect(result.dataMask.extraFormData.time_range).toBe(expectedRange);
  });
});

describe('getHeatmapDrillFilters', () => {
  test('builds equality filters with raw values and formatted display labels', () => {
    const filters = getHeatmapDrillFilters({
      xColumn: 'day_of_week',
      yColumn: 'hour',
      xValue: 'Monday',
      yValue: 9,
    });

    expect(filters).toEqual([
      { col: 'day_of_week', op: '==', val: 'Monday', formattedVal: 'Monday' },
      { col: 'hour', op: '==', val: 9, formattedVal: '9' },
    ]);
  });

  test('emits op: IS NULL and formattedVal: <NULL> for null and undefined values', () => {
    const filters = getHeatmapDrillFilters({
      xColumn: 'day_of_week',
      yColumn: 'hour',
      xValue: null,
      yValue: undefined,
    });

    expect(filters).toEqual([
      { col: 'day_of_week', op: 'IS NULL', formattedVal: '<NULL>' },
      { col: 'hour', op: 'IS NULL', formattedVal: '<NULL>' },
    ]);
  });

  test('serializes bigint values to string in val and formats them', () => {
    const filters = getHeatmapDrillFilters({
      xColumn: 'entity_id',
      yColumn: 'hour',
      xValue: 9007199254740993n,
      yValue: 10,
    });

    expect(filters).toEqual([
      {
        col: 'entity_id',
        op: '==',
        val: '9007199254740993',
        formattedVal: '9007199254740993',
      },
      { col: 'hour', op: '==', val: 10, formattedVal: '10' },
    ]);
  });

  test('formats empty string as val: "" and formattedVal: <empty string>', () => {
    const filters = getHeatmapDrillFilters({
      xColumn: 'category',
      yColumn: 'status',
      xValue: '',
      yValue: 'active',
    });

    expect(filters).toEqual([
      { col: 'category', op: '==', val: '', formattedVal: EMPTY_STRING },
      { col: 'status', op: '==', val: 'active', formattedVal: 'active' },
    ]);
  });

  test('handles ad-hoc SQL expression column object preserving col and label', () => {
    const adhocColumn = {
      sqlExpression: "CONCAT(dept, '_', team)",
      label: 'dept_team',
      expressionType: 'SQL' as const,
    };
    const filters = getHeatmapDrillFilters({
      xColumn: adhocColumn,
      yColumn: 'metric_bin',
      xValue: 'Sales_Direct',
      yValue: 5,
    });

    expect(filters).toEqual([
      {
        col: adhocColumn,
        op: '==',
        val: 'Sales_Direct',
        formattedVal: 'Sales_Direct',
      },
      { col: 'metric_bin', op: '==', val: 5, formattedVal: '5' },
    ]);
  });

  test('deduplicates when x and y columns and values are identical', () => {
    const filters = getHeatmapDrillFilters({
      xColumn: 'category',
      yColumn: 'category',
      xValue: 'A',
      yValue: 'A',
    });

    expect(filters).toEqual([
      { col: 'category', op: '==', val: 'A', formattedVal: 'A' },
    ]);
  });

  test('deduplicates when x and y columns are identical and both are null or undefined', () => {
    const filters = getHeatmapDrillFilters({
      xColumn: 'category',
      yColumn: 'category',
      xValue: null,
      yValue: undefined,
    });

    expect(filters).toEqual([
      { col: 'category', op: 'IS NULL', formattedVal: '<NULL>' },
    ]);
  });

  test('does not deduplicate when column is identical but values differ', () => {
    const filters = getHeatmapDrillFilters({
      xColumn: 'category',
      yColumn: 'category',
      xValue: 'A',
      yValue: 'B',
    });

    expect(filters).toEqual([
      { col: 'category', op: '==', val: 'A', formattedVal: 'A' },
      { col: 'category', op: '==', val: 'B', formattedVal: 'B' },
    ]);
  });

  test('handles when only xColumn or only yColumn is provided', () => {
    const onlyX = getHeatmapDrillFilters({
      xColumn: 'day_of_week',
      xValue: 'Monday',
      yValue: 9,
    });
    expect(onlyX).toEqual([
      { col: 'day_of_week', op: '==', val: 'Monday', formattedVal: 'Monday' },
    ]);

    const onlyY = getHeatmapDrillFilters({
      yColumn: 'hour',
      xValue: 'Monday',
      yValue: 9,
    });
    expect(onlyY).toEqual([
      { col: 'hour', op: '==', val: 9, formattedVal: '9' },
    ]);
  });

  test('handles groupby passed as array of columns', () => {
    const filters = getHeatmapDrillFilters({
      xColumn: 'day_of_week',
      yColumn: ['hour'],
      xValue: 'Monday',
      yValue: 9,
    });

    expect(filters).toEqual([
      { col: 'day_of_week', op: '==', val: 'Monday', formattedVal: 'Monday' },
      { col: 'hour', op: '==', val: 9, formattedVal: '9' },
    ]);
  });

  test('drill to detail on temporal axis with timeGrain emits equality filter carrying grain, val: bucket.getTime(), and formattedVal', () => {
    const epoch = Date.parse('2024-01-01T00:00:00.000Z');
    const filters = getHeatmapDrillFilters({
      xColumn: 'order_date',
      yColumn: 'channel',
      xValue: epoch,
      yValue: 'web',
      coltypeMapping: { order_date: GenericDataType.Temporal },
      timeGrain: TimeGranularity.MONTH,
    });

    expect(filters[0]).toEqual({
      col: 'order_date',
      op: '==',
      val: epoch,
      grain: TimeGranularity.MONTH,
      formattedVal: expect.any(String),
    });
    expect(filters[1]).toEqual({
      col: 'channel',
      op: '==',
      val: 'web',
      formattedVal: 'web',
    });
  });

  test('drill to detail on temporal axis without timeGrain emits equality filter with naive ISO datetime in val', () => {
    const epoch = Date.parse('2024-01-01T00:00:00.000Z');
    const filters = getHeatmapDrillFilters({
      xColumn: 'order_date',
      yColumn: 'channel',
      xValue: epoch,
      yValue: 'web',
      coltypeMapping: { order_date: GenericDataType.Temporal },
    });

    expect(filters[0]).toEqual({
      col: 'order_date',
      op: '==',
      val: '2024-01-01T00:00:00',
      formattedVal: expect.any(String),
    });
  });

  test('drill to detail on DTTM_ALIAS resolves to granularitySqla', () => {
    const epoch = Date.parse('2024-01-01T00:00:00.000Z');
    const filters = getHeatmapDrillFilters({
      xColumn: DTTM_ALIAS,
      yColumn: 'channel',
      xValue: epoch,
      yValue: 'web',
      granularitySqla: 'order_date',
      timeGrain: TimeGranularity.MONTH,
    });

    expect(filters[0]).toMatchObject({
      col: 'order_date',
      grain: TimeGranularity.MONTH,
      val: epoch,
    });
  });
});

describe('getHeatmapDrillByFilters', () => {
  test('populates filters with y-axis, xAxisFilters with x-axis, and groupbyFieldName: groupby', () => {
    const drillBy = getHeatmapDrillByFilters({
      xColumn: 'day_of_week',
      yColumn: 'hour',
      xValue: 'Monday',
      yValue: 9,
    });

    expect(drillBy).toEqual({
      filters: [{ col: 'hour', op: '==', val: 9, formattedVal: '9' }],
      xAxisFilters: [
        {
          col: 'day_of_week',
          op: '==',
          val: 'Monday',
          formattedVal: 'Monday',
        },
      ],
      groupbyFieldName: 'groupby',
    });
  });

  test('emits op: IS NULL for null and undefined dimensions across both axes', () => {
    const drillBy = getHeatmapDrillByFilters({
      xColumn: 'day_of_week',
      yColumn: 'hour',
      xValue: null,
      yValue: undefined,
    });

    expect(drillBy).toEqual({
      filters: [{ col: 'hour', op: 'IS NULL', formattedVal: '<NULL>' }],
      xAxisFilters: [
        { col: 'day_of_week', op: 'IS NULL', formattedVal: '<NULL>' },
      ],
      groupbyFieldName: 'groupby',
    });
  });

  test('serializes bigint dimension values to string in val', () => {
    const drillBy = getHeatmapDrillByFilters({
      xColumn: 'entity_id',
      yColumn: 'hour',
      xValue: 9007199254740993n,
      yValue: 10,
    });

    expect(drillBy.xAxisFilters[0]).toEqual({
      col: 'entity_id',
      op: '==',
      val: '9007199254740993',
      formattedVal: '9007199254740993',
    });
    expect(drillBy.filters[0]).toEqual({
      col: 'hour',
      op: '==',
      val: 10,
      formattedVal: '10',
    });
  });

  test('formats empty string as val: "" and formattedVal: <empty string>', () => {
    const drillBy = getHeatmapDrillByFilters({
      xColumn: 'category',
      yColumn: 'status',
      xValue: '',
      yValue: 'active',
    });

    expect(drillBy.xAxisFilters[0]).toEqual({
      col: 'category',
      op: '==',
      val: '',
      formattedVal: EMPTY_STRING,
    });
    expect(drillBy.filters[0]).toEqual({
      col: 'status',
      op: '==',
      val: 'active',
      formattedVal: 'active',
    });
  });

  test('handles ad-hoc SQL expression column object preserving col and label', () => {
    const adhocColumn = {
      sqlExpression: "CONCAT(dept, '_', team)",
      label: 'dept_team',
      expressionType: 'SQL' as const,
    };
    const drillBy = getHeatmapDrillByFilters({
      xColumn: adhocColumn,
      yColumn: 'metric_bin',
      xValue: 'Sales_Direct',
      yValue: 5,
    });

    expect(drillBy.xAxisFilters[0]).toEqual({
      col: adhocColumn,
      op: '==',
      val: 'Sales_Direct',
      formattedVal: 'Sales_Direct',
    });
    expect(drillBy.filters[0]).toEqual({
      col: 'metric_bin',
      op: '==',
      val: 5,
      formattedVal: '5',
    });
  });

  test('guards duplicate x and y columns without throwing and keeps separate 2D filters', () => {
    const drillBy = getHeatmapDrillByFilters({
      xColumn: 'category',
      yColumn: 'category',
      xValue: 'A',
      yValue: 'B',
    });

    expect(drillBy).toEqual({
      filters: [{ col: 'category', op: '==', val: 'B', formattedVal: 'B' }],
      xAxisFilters: [
        { col: 'category', op: '==', val: 'A', formattedVal: 'A' },
      ],
      groupbyFieldName: 'groupby',
    });
  });

  test('handles when xColumn or yColumn is missing or empty array', () => {
    const onlyX = getHeatmapDrillByFilters({
      xColumn: 'day_of_week',
      yColumn: undefined,
      xValue: 'Monday',
      yValue: 9,
    });
    expect(onlyX).toEqual({
      filters: [],
      xAxisFilters: [
        {
          col: 'day_of_week',
          op: '==',
          val: 'Monday',
          formattedVal: 'Monday',
        },
      ],
      groupbyFieldName: 'groupby',
    });

    const onlyY = getHeatmapDrillByFilters({
      xColumn: undefined,
      yColumn: ['hour'],
      xValue: 'Monday',
      yValue: 9,
    });
    expect(onlyY).toEqual({
      filters: [{ col: 'hour', op: '==', val: 9, formattedVal: '9' }],
      xAxisFilters: [],
      groupbyFieldName: 'groupby',
    });

    const emptyGroupby = getHeatmapDrillByFilters({
      xColumn: 'day_of_week',
      yColumn: [],
      xValue: 'Monday',
      yValue: 9,
    });
    expect(emptyGroupby).toEqual({
      filters: [],
      xAxisFilters: [
        {
          col: 'day_of_week',
          op: '==',
          val: 'Monday',
          formattedVal: 'Monday',
        },
      ],
      groupbyFieldName: 'groupby',
    });
  });

  test('drill by on temporal axis with timeGrain uses getTemporalBucketDrillByFilter for xAxisFilters', () => {
    const epoch = Date.parse('2024-01-01T00:00:00.000Z');
    const drillBy = getHeatmapDrillByFilters({
      xColumn: 'order_date',
      yColumn: 'channel',
      xValue: epoch,
      yValue: 'web',
      coltypeMapping: { order_date: GenericDataType.Temporal },
      timeGrain: TimeGranularity.MONTH,
    });

    expect(drillBy.xAxisFilters[0]).toEqual({
      col: 'order_date',
      op: '==',
      val: epoch,
      grain: TimeGranularity.MONTH,
      formattedVal: expect.any(String),
    });
    expect(drillBy.filters[0]).toEqual({
      col: 'channel',
      op: '==',
      val: 'web',
      formattedVal: 'web',
    });
  });

  test('drill by on temporal axis without timeGrain uses getTemporalBucketDrillByFilter with naive datetime', () => {
    const epoch = Date.parse('2024-01-01T00:00:00.000Z');
    const drillBy = getHeatmapDrillByFilters({
      xColumn: 'order_date',
      yColumn: 'channel',
      xValue: epoch,
      yValue: 'web',
      coltypeMapping: { order_date: GenericDataType.Temporal },
    });

    expect(drillBy.xAxisFilters[0]).toEqual({
      col: 'order_date',
      op: '==',
      val: '2024-01-01T00:00:00',
      formattedVal: expect.any(String),
    });
  });

  test('drill by on DTTM_ALIAS resolves to granularitySqla', () => {
    const epoch = Date.parse('2024-01-01T00:00:00.000Z');
    const drillBy = getHeatmapDrillByFilters({
      xColumn: DTTM_ALIAS,
      yColumn: 'channel',
      xValue: epoch,
      yValue: 'web',
      granularitySqla: 'order_date',
      timeGrain: TimeGranularity.MONTH,
    });

    expect(drillBy.xAxisFilters[0]).toMatchObject({
      col: 'order_date',
      grain: TimeGranularity.MONTH,
      val: epoch,
    });
  });
});
