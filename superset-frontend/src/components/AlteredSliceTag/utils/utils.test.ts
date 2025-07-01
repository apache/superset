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

import { alterForComparison, formatValueHandler, getRowsFromDiffs } from '.';
import { RowType } from '../types';

describe('alterForComparison', () => {
  it('returns null for undefined value', () => {
    expect(alterForComparison(undefined)).toBeNull();
  });

  it('returns null for null value', () => {
    expect(alterForComparison(null)).toBeNull();
  });

  it('returns null for empty string value', () => {
    expect(alterForComparison('')).toBeNull();
  });

  it('returns null for empty array value', () => {
    expect(alterForComparison([])).toBeNull();
  });

  it('returns null for empty object value', () => {
    expect(alterForComparison({})).toBeNull();
  });

  it('returns value for non-empty array', () => {
    const value = [1, 2, 3];
    expect(alterForComparison(value)).toEqual(value);
  });

  it('returns value for non-empty object', () => {
    const value = { key: 'value' };
    expect(alterForComparison(value)).toEqual(value);
  });
});

describe('formatValueHandler', () => {
  const controlsMap = {
    b: { type: 'BoundsControl', label: 'Bounds' },
    column_collection: { type: 'CollectionControl', label: 'Collection' },
    metrics: { type: 'MetricsControl', label: 'Metrics' },
    adhoc_filters: { type: 'AdhocFilterControl', label: 'Adhoc' },
    other_control: { type: 'OtherControl', label: 'Other' },
  };

  it('handles undefined value', () => {
    const value = undefined;
    const key = 'b';

    const formattedValue: string | number = formatValueHandler(
      value,
      key,
      controlsMap,
    );

    expect(formattedValue).toBe('N/A');
  });

  it('handles null value', () => {
    const value = null;
    const key = 'b';

    const formattedValue: string | number = formatValueHandler(
      value,
      key,
      controlsMap,
    );

    expect(formattedValue).toBe('null');
  });

  it('returns "[]" for empty filters', () => {
    const value: unknown[] = [];
    const key = 'adhoc_filters';

    const formattedValue: string | number = formatValueHandler(
      value,
      key,
      controlsMap,
    );

    expect(formattedValue).toBe('[]');
  });

  it('formats filters with array values', () => {
    const filters = [
      {
        clause: 'WHERE',
        comparator: ['1', 'g', '7', 'ho'],
        expressionType: 'SIMPLE',
        operator: 'IN',
        subject: 'a',
      },
      {
        clause: 'WHERE',
        comparator: ['hu', 'ho', 'ha'],
        expressionType: 'SIMPLE',
        operator: 'NOT IN',
        subject: 'b',
      },
    ];
    const key = 'adhoc_filters';

    const expected = 'a IN [1, g, 7, ho], b NOT IN [hu, ho, ha]';
    const formattedValue: string | number = formatValueHandler(
      filters,
      key,
      controlsMap,
    );

    expect(formattedValue).toBe(expected);
  });

  it('formats filters with string values', () => {
    const filters = [
      {
        clause: 'WHERE',
        comparator: 'gucci',
        expressionType: 'SIMPLE',
        operator: '==',
        subject: 'a',
      },
      {
        clause: 'WHERE',
        comparator: 'moshi moshi',
        expressionType: 'SIMPLE',
        operator: 'LIKE',
        subject: 'b',
      },
    ];

    const key = 'adhoc_filters';
    const expected = 'a == gucci, b LIKE moshi moshi';
    const formattedValue: string | number = formatValueHandler(
      filters,
      key,
      controlsMap,
    );

    expect(formattedValue).toBe(expected);
  });

  it('formats "Min" and "Max" for BoundsControl', () => {
    const value: number[] = [1, 2];
    const key = 'b';

    const result: string | number = formatValueHandler(value, key, controlsMap);

    expect(result).toEqual('Min: 1, Max: 2');
  });

  it('formats stringified objects for CollectionControl', () => {
    const value = [{ a: 1 }, { b: 2 }];
    const key = 'column_collection';

    const result: string | number = formatValueHandler(value, key, controlsMap);

    expect(result).toEqual(
      `${JSON.stringify(value[0])}, ${JSON.stringify(value[1])}`,
    );
  });

  it('formats MetricsControl values correctly', () => {
    const value = [{ label: 'SUM(Sales)' }, { label: 'Metric2' }];
    const key = 'metrics';

    const result: string | number = formatValueHandler(value, key, controlsMap);

    expect(result).toEqual('SUM(Sales), Metric2');
  });

  it('formats boolean values as string', () => {
    const value1 = true;
    const value2 = false;
    const key = 'b';

    const formattedValue1: string | number = formatValueHandler(
      value1,
      key,
      controlsMap,
    );
    const formattedValue2: string | number = formatValueHandler(
      value2,
      key,
      controlsMap,
    );

    expect(formattedValue1).toBe('true');
    expect(formattedValue2).toBe('false');
  });

  it('formats array values correctly', () => {
    const value = [
      { label: 'Label1' },
      { label: 'Label2' },
      5,
      6,
      7,
      8,
      'hello',
      'goodbye',
    ];

    const expected = 'Label1, Label2, 5, 6, 7, 8, hello, goodbye';
    const result: string | number = formatValueHandler(
      value,
      undefined,
      controlsMap,
    );

    expect(result).toEqual(expected);
  });

  it('formats string values correctly', () => {
    const value = 'test';
    const key = 'other_control';

    const result: string | number = formatValueHandler(value, key, controlsMap);

    expect(result).toEqual('test');
  });

  it('formats number values correctly', () => {
    const value = 123;
    const key = 'other_control';

    const result: string | number = formatValueHandler(value, key, controlsMap);

    expect(result).toEqual(123);
  });

  it('formats object values correctly', () => {
    const value = { 1: 2, alpha: 'bravo' };
    const key = 'other_control';
    const expected = '{"1":2,"alpha":"bravo"}';

    const result: string | number = formatValueHandler(value, key, controlsMap);

    expect(result).toEqual(expected);
  });
});

describe('getRowsFromDiffs', () => {
  it('returns formatted rows for diffs', () => {
    const diffs = {
      metric: { before: [{ label: 'old' }], after: [{ label: 'new' }] },
      limit: { before: 10, after: 20 },
    };

    const controlsMap = {
      metric: { label: 'Metric', type: 'MetricsControl' },
      limit: { label: 'Row Limit', type: 'TextControl' },
    };

    const rows: RowType[] = getRowsFromDiffs(diffs, controlsMap);

    expect(rows).toEqual([
      { control: 'Metric', before: 'old', after: 'new' },
      { control: 'Row Limit', before: 10, after: 20 },
    ]);
  });

  it('falls back to key if label is missing', () => {
    const diffs = {
      unknown: { before: 'a', after: 'b' },
    };

    const controlsMap = {};
    const rows: RowType[] = getRowsFromDiffs(diffs, controlsMap);

    expect(rows).toEqual([{ control: 'unknown', before: 'a', after: 'b' }]);
  });
});
