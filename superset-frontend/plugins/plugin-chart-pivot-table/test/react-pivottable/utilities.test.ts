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

// Records shaped like PivotTableChart.tsx's real output: the "Metric" pseudo
// -dimension is the sole column, so each record's own rollup level has no
// "real" columns -- which is exactly the condition that also mirrors its
// value into the row-total/grand-total slots (see `processRecord`'s
// "Metric-collapse totals").
const metricRecord = (metric: string, value: number): PivotRecord =>
  ({
    Metric: metric,
    value,
    __metricKey: 'Metric',
    __rows: [],
    __columns: ['Metric'],
  }) as unknown as PivotRecord;

test('grand total renders blank when it would combine two different metrics', () => {
  const pivotData = new PivotData({
    data: [metricRecord('MAX(sales)', 100), metricRecord('MEDIAN(msrp)', 50)],
    rows: [],
    cols: ['Metric'],
    vals: ['value'],
  });

  // Neither metric's own value -- there's no single number that means
  // "max of sales combined with median of msrp".
  expect(pivotData.getAggregator([], []).value()).toBeNull();
});

test('grand total still passes through the value for a single metric', () => {
  const pivotData = new PivotData({
    data: [metricRecord('MAX(sales)', 100)],
    rows: [],
    cols: ['Metric'],
    vals: ['value'],
  });

  expect(pivotData.getAggregator([], []).value()).toBe(100);
});
