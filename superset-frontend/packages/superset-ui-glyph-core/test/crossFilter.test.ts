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
import type { ChartProps, FilterState } from '@superset-ui/core';
import {
  createLabelMap,
  createSelectedValuesMap,
  extractCrossFilterProps,
  isDataPointFiltered,
} from '@superset-ui/glyph-core';

describe('createSelectedValuesMap', () => {
  test('returns empty object when filterState is undefined', () => {
    expect(createSelectedValuesMap(undefined, ['a', 'b'])).toEqual({});
  });

  test('returns empty object when selectedValues is undefined', () => {
    expect(
      createSelectedValuesMap({} as FilterState, ['a', 'b']),
    ).toEqual({});
  });

  test('returns empty object when selectedValues is empty', () => {
    expect(
      createSelectedValuesMap(
        { selectedValues: [] } as unknown as FilterState,
        ['a', 'b'],
      ),
    ).toEqual({});
  });

  test('maps selected value to its index in seriesNames', () => {
    const result = createSelectedValuesMap(
      { selectedValues: ['b'] } as unknown as FilterState,
      ['a', 'b', 'c'],
    );
    expect(result).toEqual({ 1: 'b' });
  });

  test('maps multiple selected values to their indices', () => {
    const result = createSelectedValuesMap(
      { selectedValues: ['a', 'c'] } as unknown as FilterState,
      ['a', 'b', 'c'],
    );
    expect(result).toEqual({ 0: 'a', 2: 'c' });
  });

  test('ignores selected values not in seriesNames', () => {
    const result = createSelectedValuesMap(
      { selectedValues: ['x', 'a'] } as unknown as FilterState,
      ['a', 'b', 'c'],
    );
    expect(result).toEqual({ 0: 'a' });
  });
});

describe('isDataPointFiltered', () => {
  test('returns false when no filterState', () => {
    expect(isDataPointFiltered(undefined, 'a')).toBe(false);
  });

  test('returns false when selectedValues is empty', () => {
    expect(
      isDataPointFiltered(
        { selectedValues: [] } as unknown as FilterState,
        'a',
      ),
    ).toBe(false);
  });

  test('returns false when name is in selectedValues', () => {
    expect(
      isDataPointFiltered(
        { selectedValues: ['a', 'b'] } as unknown as FilterState,
        'a',
      ),
    ).toBe(false);
  });

  test('returns true when name is NOT in non-empty selectedValues', () => {
    expect(
      isDataPointFiltered(
        { selectedValues: ['a', 'b'] } as unknown as FilterState,
        'c',
      ),
    ).toBe(true);
  });
});

describe('createLabelMap', () => {
  test('returns empty object for empty data', () => {
    expect(createLabelMap([], ['col1'], () => 'label')).toEqual({});
  });

  test('maps each record to its label and groupby column values', () => {
    const data = [
      { country: 'USA', region: 'North' },
      { country: 'Brazil', region: 'South' },
    ];
    const result = createLabelMap(
      data,
      ['country', 'region'],
      d => d.country as string,
    );
    expect(result).toEqual({
      USA: ['USA', 'North'],
      Brazil: ['Brazil', 'South'],
    });
  });

  test('last record wins when extractLabel collides', () => {
    const data = [
      { name: 'X', value: 1 },
      { name: 'X', value: 2 },
    ];
    const result = createLabelMap(data, ['value'], d => d.name as string);
    // collision: later entry overwrites
    expect(result).toEqual({ X: [2] });
  });

  test('groupbyLabels controls the columns extracted, not the label', () => {
    const data = [{ a: 1, b: 2, c: 3 }];
    const result = createLabelMap(data, ['c'], () => 'only-key');
    expect(result).toEqual({ 'only-key': [3] });
  });
});

describe('extractCrossFilterProps', () => {
  const baseChartProps = {
    hooks: { setDataMask: jest.fn(), onContextMenu: jest.fn() },
    filterState: {
      selectedValues: ['USA'],
    } as unknown as FilterState,
    emitCrossFilters: true,
    formData: { viz_type: 'test' },
  } as unknown as ChartProps;

  test('returns all expected fields', () => {
    const result = extractCrossFilterProps(
      baseChartProps,
      ['country'],
      { USA: ['USA'] },
      ['USA', 'Brazil'],
    );
    expect(result.groupby).toEqual(['country']);
    expect(result.labelMap).toEqual({ USA: ['USA'] });
    expect(result.selectedValues).toEqual({ 0: 'USA' });
    expect(result.emitCrossFilters).toBe(true);
    expect(result.setDataMask).toBe(baseChartProps.hooks!.setDataMask);
    expect(result.onContextMenu).toBe(baseChartProps.hooks!.onContextMenu);
  });

  test('coltypeMapping pass-through when provided', () => {
    const result = extractCrossFilterProps(
      baseChartProps,
      ['country'],
      {},
      [],
      { country: 1 },
    );
    expect(result.coltypeMapping).toEqual({ country: 1 });
  });

  test('defaults setDataMask to a no-op when hooks omits it', () => {
    const chartProps = {
      ...baseChartProps,
      hooks: {},
    } as unknown as ChartProps;
    const result = extractCrossFilterProps(chartProps, [], {}, []);
    expect(typeof result.setDataMask).toBe('function');
    // No throw when invoked
    expect(() =>
      result.setDataMask({ filterState: {} } as unknown as Parameters<
        typeof result.setDataMask
      >[0]),
    ).not.toThrow();
  });

  test('formData is included in the returned shape (for context menu formatting)', () => {
    const result = extractCrossFilterProps(
      baseChartProps,
      ['country'],
      {},
      [],
    ) as ReturnType<typeof extractCrossFilterProps> & { formData: unknown };
    expect(result.formData).toEqual({ viz_type: 'test' });
  });

  test('selectedValues is empty when filterState has none', () => {
    const chartProps = {
      ...baseChartProps,
      filterState: {} as FilterState,
    } as unknown as ChartProps;
    const result = extractCrossFilterProps(chartProps, [], {}, ['x']);
    expect(result.selectedValues).toEqual({});
  });
});
