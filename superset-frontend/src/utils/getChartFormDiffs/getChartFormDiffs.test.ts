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
import { JsonObject } from '@superset-ui/core';
import { alterForComparison, getChartFormDiffs, isEqualish } from '.';

jest.mock('../sanitizeFormData', () => ({
  sanitizeFormData: (fd: JsonObject): JsonObject => ({
    ...fd,
    _sanitized: true,
  }),
}));

describe('alterForComparison', () => {
  it.each([
    [null, null],
    ['', null],
    [[], null],
    [{}, null],
    [
      [1, 2],
      [1, 2],
    ],
    [{ a: 1 }, { a: 1 }],
    ['foo', 'foo'],
  ])('normalizes %p to %p', (input, expected) => {
    expect(alterForComparison(input)).toEqual(expected);
  });
});

describe('isEqualish', () => {
  it('returns true for semantically equal values with different formats', () => {
    expect(isEqualish('', null)).toBe(true);
    expect(isEqualish([], null)).toBe(true);
    expect(isEqualish({}, null)).toBe(true);
    expect(isEqualish([1], [1])).toBe(true);
  });

  it('returns false for clearly different values', () => {
    expect(isEqualish([1], [2])).toBe(false);
    expect(isEqualish({ a: 1 }, { a: 2 })).toBe(false);
    expect(isEqualish('foo', 'bar')).toBe(false);
  });
});

describe('getChartFormDiffs', () => {
  it('returns diffs for changed values', () => {
    const original = { metric: 'count', adhoc_filters: [] };
    const current = { metric: 'sum__num', adhoc_filters: [] };

    const diffs = getChartFormDiffs(original, current);

    expect(diffs).toHaveProperty('metric');
    expect(diffs.metric).toEqual({
      before: 'count',
      after: 'sum__num',
    });
  });

  it('ignores noisy keys', () => {
    const original = { where: 'a = 1', metric: 'count' };
    const current = { where: 'a = 2', metric: 'sum__num' };

    const diffs = getChartFormDiffs(original, current);

    expect(diffs).not.toHaveProperty('where');
    expect(diffs).toHaveProperty('metric');
  });

  it('does not include values that are equalish', () => {
    const original = { filters: [], metric: 'count' };
    const current = { filters: null, metric: 'count' };

    const diffs = getChartFormDiffs(original, current);

    expect(diffs).toEqual({});
  });

  it('handles missing keys in original or current gracefully', () => {
    const original = { metric: 'count' };
    const current = { metric: 'count', new_field: 'value' };

    const diffs = getChartFormDiffs(original, current);

    expect(diffs).toHaveProperty('new_field');
    expect(diffs.new_field).toEqual({
      before: undefined,
      after: 'value',
    });
  });

  it('ignores keys that are missing in current and not explicitly changed', () => {
    const original = { metric: 'count', removed_field: 'gone' };
    const current = { metric: 'count' };

    const diffs = getChartFormDiffs(original, current);

    expect(diffs).not.toHaveProperty('removed_field');
  });
});
