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

test('Average excludes a real SQL NULL group instead of counting it as zero', () => {
  const aggregator = aggregators.Average(['x'])();
  [{ x: 10 }, { x: null }, { x: 20 }].forEach(record =>
    aggregator.push(record as unknown as PivotRecord),
  );
  // (10 + 20) / 2 = 15, not (10 + 0 + 20) / 3 = 10.
  expect(aggregator.value()).toBe(15);
});

test('Median excludes a real SQL NULL group instead of counting it as zero', () => {
  const aggregator = aggregators.Median(['x'])();
  [{ x: 10 }, { x: null }, { x: 20 }, { x: 30 }].forEach(record =>
    aggregator.push(record as unknown as PivotRecord),
  );
  // median of [10, 20, 30] = 20, not median of [0, 10, 20, 30] = 15.
  expect(aggregator.value()).toBe(20);
});

test('Sum excludes a real SQL NULL group instead of poisoning the total with NaN', () => {
  const aggregator = aggregators.Sum(['x'])();
  [{ x: 10 }, { x: null }, { x: 20 }].forEach(record =>
    aggregator.push(record as unknown as PivotRecord),
  );
  // 10 + 20 = 30, not NaN from parseFloat(String(null)).
  expect(aggregator.value()).toBe(30);
});

test('Minimum excludes a real SQL NULL group instead of counting it as zero', () => {
  // Number(null) coerces to 0, which would otherwise win as the minimum.
  expect(aggregate('Minimum', [{ x: 10 }, { x: null }, { x: 20 }])).toBe(10);
});

test('Maximum excludes a real SQL NULL group instead of counting it as zero', () => {
  // Number(null) coerces to 0, which would otherwise win as the maximum
  // when every real value is negative.
  expect(aggregate('Maximum', [{ x: -10 }, { x: null }, { x: -20 }])).toBe(-10);
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

// Same "Metric-collapse totals" mirroring as `metricRecord` above, but with a
// real row dimension present so the mix lands in a row Total slot instead of
// the grand-total corner -- `processRecord` routes both the same way.
const metricRowRecord = (
  color: string,
  metric: string,
  value: number,
): PivotRecord =>
  ({
    color,
    Metric: metric,
    value,
    __metricKey: 'Metric',
    __rows: ['color'],
    __columns: ['Metric'],
  }) as unknown as PivotRecord;

test('row total renders blank when it would combine two different metrics', () => {
  const pivotData = new PivotData({
    data: [
      metricRowRecord('blue', 'MAX(sales)', 100),
      metricRowRecord('blue', 'MEDIAN(msrp)', 50),
    ],
    rows: ['color'],
    cols: ['Metric'],
    vals: ['value'],
  });

  expect(pivotData.getAggregator(['blue'], []).value()).toBeNull();
});

// Leaf records shaped like a real query result: one row per full dimension
// combination (region, store), each already carrying the metric's own
// aggregate for that group -- never raw, ungrouped source rows.
const RESULT_AGGREGATION_LEAVES: PivotRecord[] = [
  { region: 'North', store: 'A', value: 10 },
  { region: 'North', store: 'B', value: 20 },
  { region: 'South', store: 'C', value: 100 },
] as unknown as PivotRecord[];

test('result aggregation reduces the grand summary from every original leaf record, not from subtotals', () => {
  const pivotData = new PivotData(
    {
      data: RESULT_AGGREGATION_LEAVES,
      rows: ['region', 'store'],
      cols: [],
      vals: ['value'],
      aggregateFunction: 'Average',
    },
    { rowEnabled: true },
  );

  // North subtotal: average of North's own two leaves (10, 20).
  expect(pivotData.getAggregator(['North'], []).value()).toBe(15);
  // Grand summary: average of all three leaves (10, 20, 100) = 43.33 --
  // not the average of the two region subtotals ((15 + 100) / 2 = 57.5),
  // which is exactly the pre-SIP-216 bug this restores without repeating.
  expect(pivotData.getAggregator([], []).value()).toBeCloseTo(43.33, 2);
});

test('result aggregation blanks a shared total slot that would mix two different metrics', () => {
  const mixedMetricLeaves: PivotRecord[] = [
    {
      Metric: 'MAX(sales)',
      value: 100,
      __metricKey: 'Metric',
    },
    {
      Metric: 'MEDIAN(msrp)',
      value: 50,
      __metricKey: 'Metric',
    },
  ] as unknown as PivotRecord[];
  const pivotData = new PivotData({
    data: mixedMetricLeaves,
    rows: [],
    cols: ['Metric'],
    vals: ['value'],
    aggregateFunction: 'Average',
  });

  // Not the average of a MAX(sales) value and a MEDIAN(msrp) value blended
  // together -- there's no single number that means anything for that.
  expect(pivotData.getAggregator([], []).value()).toBeNull();
});

test('a non-fraction result aggregation keeps the metric\'s own custom formatter', () => {
  // Median re-aggregates SUM(sales)'s own per-store values; disabling every
  // custom formatter whenever any result aggregation was active (instead of
  // only the " as Fraction of " ones, which render their own percentage)
  // used to fall back on a differently-reduced `cellValue` passthrough here,
  // silently dropping both the currency formatting and the median itself.
  const leaves: PivotRecord[] = [
    { Metric: 'SUM(sales)', store: 'A', value: 10, __metricKey: 'Metric' },
    { Metric: 'SUM(sales)', store: 'B', value: 30, __metricKey: 'Metric' },
  ] as unknown as PivotRecord[];
  const currencyFormatter = jest.fn((x: unknown) => `$${x}`);
  const pivotData = new PivotData({
    data: leaves,
    rows: [],
    cols: ['Metric'],
    vals: ['value'],
    aggregateFunction: 'Median',
    customFormatters: { Metric: { 'SUM(sales)': currencyFormatter } },
  });

  const agg = pivotData.getAggregator([], ['SUM(sales)']);
  expect(agg.value()).toBe(20);
  expect(agg.format(agg.value())).toBe('$20');
  expect(currencyFormatter).toHaveBeenCalledWith(20);
});

test('"... as Fraction of ..." keeps its own percentage even when a custom formatter is configured', () => {
  // The fraction result aggregations render their own ratio, the same as
  // the legacy `showValuesAs` percent modes -- a per-metric custom
  // formatter must not leak in and reformat that ratio as e.g. currency.
  const leaves: PivotRecord[] = [
    { Metric: 'SUM(sales)', store: 'A', value: 10, __metricKey: 'Metric' },
    { Metric: 'SUM(sales)', store: 'B', value: 30, __metricKey: 'Metric' },
  ] as unknown as PivotRecord[];
  const currencyFormatter = jest.fn((x: unknown) => `$${x}`);
  const pivotData = new PivotData({
    data: leaves,
    rows: ['store'],
    cols: ['Metric'],
    vals: ['value'],
    aggregateFunction: 'Sum as Fraction of Total',
    customFormatters: { Metric: { 'SUM(sales)': currencyFormatter } },
  });

  const agg = pivotData.getAggregator(['A'], ['SUM(sales)']);
  expect(agg.value()).toBeCloseTo(10 / 40, 5);
  expect(agg.format(agg.value())).not.toMatch(/^\$/);
  expect(currencyFormatter).not.toHaveBeenCalled();
});

test('"... as Fraction of ..." divides by the metric\'s own total even when column subtotals are off', () => {
  // cols: [Metric, category], column subtotals off (the default here) --
  // the per-metric denominator ("Metric" alone, collapsing "category") is
  // not among the visible depths in that case, so it must come from a
  // scope tracked independently of subtotal visibility, not the depth-gated
  // tree (which would leave this blank).
  const leaves: PivotRecord[] = [
    { Metric: 'MAX(sales)', category: 'A', value: 10, __metricKey: 'Metric' },
    { Metric: 'MAX(sales)', category: 'B', value: 20, __metricKey: 'Metric' },
    { Metric: 'SUM(cost)', category: 'A', value: 5, __metricKey: 'Metric' },
    { Metric: 'SUM(cost)', category: 'B', value: 15, __metricKey: 'Metric' },
  ] as unknown as PivotRecord[];
  const pivotData = new PivotData({
    data: leaves,
    rows: [],
    cols: ['Metric', 'category'],
    vals: ['value'],
    aggregateFunction: 'Sum as Fraction of Total',
  });

  // MAX(sales) total across its own categories is 10 + 20 = 30.
  expect(pivotData.getAggregator([], ['MAX(sales)', 'A']).value()).toBeCloseTo(
    10 / 30,
    5,
  );
  expect(pivotData.getAggregator([], ['MAX(sales)', 'B']).value()).toBeCloseTo(
    20 / 30,
    5,
  );
  // SUM(cost) total across its own categories is 5 + 15 = 20, not blended
  // with MAX(sales)'s total.
  expect(pivotData.getAggregator([], ['SUM(cost)', 'A']).value()).toBeCloseTo(
    5 / 20,
    5,
  );
});

test('"... as Fraction of Rows" divides by the row total, not the metric\'s dataset-wide total, when Metric sits on columns', () => {
  // A single metric on columns: each row has nothing else to share it with,
  // so both rows should read 100%. The buggy implementation treated the
  // 'row' fraction the same as 'total' whenever the (single) metric's own
  // axis selector happened to be empty -- which it always is for 'row' too,
  // since fractionOf('row', ...) collapses the column selector -- and divided
  // by the metric's total across the whole dataset (30) instead of the row's
  // own total, reading 33%/67%.
  const leaves: PivotRecord[] = [
    {
      region: 'North',
      Metric: 'SUM(sales)',
      value: 10,
      __metricKey: 'Metric',
    },
    {
      region: 'South',
      Metric: 'SUM(sales)',
      value: 20,
      __metricKey: 'Metric',
    },
  ] as unknown as PivotRecord[];
  const pivotData = new PivotData({
    data: leaves,
    rows: ['region'],
    cols: ['Metric'],
    vals: ['value'],
    aggregateFunction: 'Sum as Fraction of Rows',
  });

  expect(
    pivotData.getAggregator(['North'], ['SUM(sales)']).value(),
  ).toBeCloseTo(1, 5);
  expect(
    pivotData.getAggregator(['South'], ['SUM(sales)']).value(),
  ).toBeCloseTo(1, 5);
});

test('"... as Fraction of Rows" stays scoped per metric, not just per row, when a row has multiple metrics', () => {
  // Two different metrics sharing one row. Scoping the denominator to the
  // row alone (dropping the metric position entirely once Metric's own axis
  // selector is empty) would sum sales and cost together and read 10%/90%;
  // it has to stay scoped to both the row and this cell's own metric, the
  // same way the metric-mixing guard on the grand-total corner (#44657)
  // never lets unlike metrics share a slot either.
  const leaves: PivotRecord[] = [
    { region: 'US', Metric: 'sales', value: 10, __metricKey: 'Metric' },
    { region: 'US', Metric: 'cost', value: 90, __metricKey: 'Metric' },
  ] as unknown as PivotRecord[];
  const pivotData = new PivotData({
    data: leaves,
    rows: ['region'],
    cols: ['Metric'],
    vals: ['value'],
    aggregateFunction: 'Sum as Fraction of Rows',
  });

  expect(pivotData.getAggregator(['US'], ['sales']).value()).toBeCloseTo(1, 5);
  expect(pivotData.getAggregator(['US'], ['cost']).value()).toBeCloseTo(1, 5);
});

test('"... as Fraction of Rows" finds a row+metric denominator when column subtotals are off', () => {
  // cols: [Metric, category], column subtotals off (the default here) -- a
  // (row, metric) tree node only exists at that depth when column subtotals
  // are on, so the denominator has to come from a scope tracked
  // independently of subtotal visibility, the same way the 'total' case
  // already relies on rowMetricTotals/colMetricTotals for the same reason.
  const leaves: PivotRecord[] = [
    {
      region: 'North',
      Metric: 'SUM(sales)',
      category: 'A',
      value: 10,
      __metricKey: 'Metric',
    },
    {
      region: 'North',
      Metric: 'SUM(sales)',
      category: 'B',
      value: 20,
      __metricKey: 'Metric',
    },
  ] as unknown as PivotRecord[];
  const pivotData = new PivotData({
    data: leaves,
    rows: ['region'],
    cols: ['Metric', 'category'],
    vals: ['value'],
    aggregateFunction: 'Sum as Fraction of Rows',
  });

  expect(
    pivotData.getAggregator(['North'], ['SUM(sales)', 'A']).value(),
  ).toBeCloseTo(10 / 30, 5);
  expect(
    pivotData.getAggregator(['North'], ['SUM(sales)', 'B']).value(),
  ).toBeCloseTo(20 / 30, 5);
});

test('"... as Fraction of Columns" finds a col+metric denominator when row subtotals are off, instead of throwing', () => {
  // Same shape as the row-fraction case above, transposed: Metric now sits
  // on rows: [Metric, category], row subtotals off (the default). Before
  // the row/colGroupMetricTotals fallback existed, substituting the metric
  // into the collapsed row axis produced a rowKey that was never created in
  // the depth-gated tree (row subtotals off), and getAggregator indexed
  // into it unguarded -- this threw instead of just returning blank.
  const leaves: PivotRecord[] = [
    {
      region: 'North',
      Metric: 'SUM(sales)',
      category: 'A',
      value: 10,
      __metricKey: 'Metric',
    },
    {
      region: 'North',
      Metric: 'SUM(sales)',
      category: 'B',
      value: 20,
      __metricKey: 'Metric',
    },
  ] as unknown as PivotRecord[];
  const pivotData = new PivotData({
    data: leaves,
    rows: ['Metric', 'category'],
    cols: ['region'],
    vals: ['value'],
    aggregateFunction: 'Sum as Fraction of Columns',
  });

  expect(() =>
    pivotData.getAggregator(['SUM(sales)', 'A'], ['North']).value(),
  ).not.toThrow();
  expect(
    pivotData.getAggregator(['SUM(sales)', 'A'], ['North']).value(),
  ).toBeCloseTo(10 / 30, 5);
  expect(
    pivotData.getAggregator(['SUM(sales)', 'B'], ['North']).value(),
  ).toBeCloseTo(20 / 30, 5);
});

test('"... as Fraction of Rows" finds a row-subtotal denominator, not just a leaf row\'s', () => {
  // rows: [region, store], row subtotals on, column subtotals off (the
  // default). A region subtotal's own row key (['North']) is a *prefix* of
  // the full leaf rowKey (['North', 'A'] / ['North', 'B']) --
  // rowGroupMetricTotals used to record an entry only for the full leaf key,
  // so a region subtotal's denominator lookup found nothing and rendered
  // blank instead of the region's own row-fraction.
  const leaves: PivotRecord[] = [
    {
      region: 'North',
      store: 'A',
      Metric: 'SUM(sales)',
      category: 'X',
      value: 10,
      __metricKey: 'Metric',
    },
    {
      region: 'North',
      store: 'B',
      Metric: 'SUM(sales)',
      category: 'Y',
      value: 20,
      __metricKey: 'Metric',
    },
  ] as unknown as PivotRecord[];
  const pivotData = new PivotData(
    {
      data: leaves,
      rows: ['region', 'store'],
      cols: ['Metric', 'category'],
      vals: ['value'],
      aggregateFunction: 'Sum as Fraction of Rows',
    },
    { rowEnabled: true },
  );

  expect(
    pivotData.getAggregator(['North'], ['SUM(sales)', 'X']).value(),
  ).toBeCloseTo(10 / 30, 5);
  expect(
    pivotData.getAggregator(['North'], ['SUM(sales)', 'Y']).value(),
  ).toBeCloseTo(20 / 30, 5);
});

test('per-metric totals survive a metric literally named "constructor"', () => {
  // rowMetricTotals/colMetricTotals are indexed by the metric's own display
  // name; a metric named "constructor" or "__proto__" must not collide with
  // Object.prototype instead of getting its own aggregator slot.
  const leaves: PivotRecord[] = [
    {
      Metric: 'constructor',
      category: 'A',
      value: 10,
      __metricKey: 'Metric',
    },
    {
      Metric: 'constructor',
      category: 'B',
      value: 20,
      __metricKey: 'Metric',
    },
  ] as unknown as PivotRecord[];
  const pivotData = new PivotData({
    data: leaves,
    rows: [],
    cols: ['Metric', 'category'],
    vals: ['value'],
    aggregateFunction: 'Sum as Fraction of Total',
  });

  expect(pivotData.getAggregator([], ['constructor', 'A']).value()).toBeCloseTo(
    10 / 30,
    5,
  );
  expect(pivotData.getAggregator([], ['constructor', 'B']).value()).toBeCloseTo(
    20 / 30,
    5,
  );
});
