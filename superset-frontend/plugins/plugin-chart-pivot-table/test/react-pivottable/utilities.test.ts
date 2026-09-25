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

import { aggregators, PivotData } from '../../src/react-pivottable/utilities';
import type { PivotRecord } from '../../src/react-pivottable/utilities';

// Records may legitimately carry null values for an attribute; PivotRecord only
// models the non-null cell types, so loosen the type at the test boundary.
type TestRecord = Record<string, string | number | boolean | null>;

type ExtremesAggregator = 'First' | 'Last' | 'Minimum' | 'Maximum';

// Build an `extremes`-based aggregator (First/Last/Minimum/Maximum) for `attr`
// and feed it the records in order, returning the resulting value.
const aggregate = (name: ExtremesAggregator, records: TestRecord[]) => {
  const aggregator = aggregators[name](['x'])();
  records.forEach(record => aggregator.push(record as PivotRecord));
  return aggregator.value();
};

test('First returns the first value in data order, not the minimum', () => {
  // Descending input: the buggy implementation returned the minimum (1).
  expect(aggregate('First', [{ x: 5 }, { x: 3 }, { x: 1 }])).toBe(5);
  expect(aggregate('First', [{ x: 1 }, { x: 3 }, { x: 5 }])).toBe(1);
});

test('Last returns the last value in data order, not the maximum', () => {
  // Ascending input: the buggy implementation returned the maximum (5).
  expect(aggregate('Last', [{ x: 1 }, { x: 3 }, { x: 5 }])).toBe(5);
  expect(aggregate('Last', [{ x: 5 }, { x: 3 }, { x: 1 }])).toBe(1);
});

test('First keeps the first non-null value, skipping a leading null', () => {
  expect(aggregate('First', [{ x: null }, { x: 7 }, { x: 9 }])).toBe(7);
});

test('First preserves a falsy first value such as zero', () => {
  expect(aggregate('First', [{ x: 0 }, { x: 5 }])).toBe(0);
});

test('Minimum and Maximum still compute extremes regardless of order', () => {
  const records = [{ x: 3 }, { x: 1 }, { x: 5 }, { x: 2 }];
  expect(aggregate('Minimum', records)).toBe(1);
  expect(aggregate('Maximum', records)).toBe(5);
});

test.each([
  ['Average', 32.5],
  ['Median', 14.5],
  ['Sum', 130],
  ['Count', 4],
  ['Minimum', 1],
  ['Maximum', 100],
  ['Count Unique Values', 4],
])(
  'saved %s aggregates contributing results, not intermediate summaries',
  (name, total) => {
    const pivot = new PivotData(
      {
        rows: ['region', 'city'],
        cols: ['metric'],
        vals: ['value'],
        aggregateFunction: name,
        data: [
          { region: 'A', city: 'a', metric: 'sales', value: 1 },
          { region: 'A', city: 'b', metric: 'sales', value: 9 },
          { region: 'A', city: 'c', metric: 'sales', value: 20 },
          { region: 'B', city: 'd', metric: 'sales', value: 100 },
        ],
      },
      { rowEnabled: true },
    );
    expect(pivot.getAggregator([], ['sales']).value()).toBe(total);
    expect(pivot.getAggregator([], []).value()).toBe(total);
    if (name === 'Median') {
      expect(pivot.getAggregator(['A'], ['sales']).value()).toBe(9);
      expect(pivot.getAggregator(['B'], ['sales']).value()).toBe(100);
      // 14.5, not the median of the subtotals (9 + 100) / 2.
      expect(pivot.getAggregator(['A', 'b'], ['sales']).value()).toBe(9);
    }
  },
);

test('result median ignores null and nonnumeric values but includes zero', () => {
  const pivot = new PivotData({
    rows: [],
    cols: [],
    vals: ['value'],
    aggregateFunction: 'Median',
    data: [null, 'invalid', 0, '10', 20, 30].map(value => ({ value })),
  });
  expect(pivot.getAggregator([], []).value()).toBe(15);
});

test('count fractions preserve record counts rather than sum of metric values', () => {
  const pivot = new PivotData({
    rows: ['region'],
    cols: [],
    vals: ['value'],
    aggregateFunction: 'Count as Fraction of Total',
    data: [
      { region: 'A', value: 10 },
      { region: 'B', value: 90 },
    ],
  });
  expect(pivot.getAggregator(['A'], []).value()).toBe(0.5);
  expect(pivot.getAggregator([], []).value()).toBe(1);
});

test.each([true, false])(
  'result summaries preserve metric layout (metrics on rows: %s)',
  onRows => {
    const pivot = new PivotData(
      {
        rows: onRows ? ['metric', 'region'] : ['region'],
        cols: onRows ? [] : ['metric'],
        vals: ['value'],
        aggregateFunction: 'Average',
        data: [
          { region: 'A', metric: 'sales', value: 10, __metricKey: 'metric' },
          { region: 'A', metric: 'profit', value: 20, __metricKey: 'metric' },
          { region: 'B', metric: 'sales', value: 100, __metricKey: 'metric' },
          { region: 'B', metric: 'profit', value: 200, __metricKey: 'metric' },
        ],
      },
      { rowEnabled: true, colEnabled: true },
    );
    expect(
      pivot
        .getAggregator(onRows ? ['sales'] : [], onRows ? [] : ['sales'])
        .value(),
    ).toBe(55);
    expect(pivot.getAggregator([], []).value()).toBe(82.5);
  },
);

test('result percentages divide by the selected summary, even with summaries hidden', () => {
  const pivot = new PivotData({
    rows: ['region'],
    cols: [],
    vals: ['value'],
    aggregateFunction: 'Average',
    showValuesAs: 'percent_total',
    data: [
      { region: 'A', value: 10 },
      { region: 'B', value: 100 },
    ],
  });
  expect(pivot.getAggregator(['A'], []).value()).toBeCloseTo(10 / 55);
  expect(pivot.getAggregator([], []).value()).toBe(1);
});

test('text-only sum retains the text rather than substituting zero', () => {
  const pivot = new PivotData({
    rows: [],
    cols: [],
    vals: ['value'],
    aggregateFunction: 'Sum',
    data: [{ value: 'Montréal' }],
  });
  expect(pivot.getAggregator([], []).value()).toBe('Montréal');
});
