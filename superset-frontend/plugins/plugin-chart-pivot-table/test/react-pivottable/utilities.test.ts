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

/*
 * #44724 -- per-metric formatters must reach the aggregation (total) cells too.
 *
 * A metric can be configured with its own value format (currency, d3 format,
 * decimal precision). `PivotData` receives those as `customFormatters`, keyed by
 * the metric pseudo-dimension and then by metric name, and resolves them through
 * `getFormattedAggregator`. Every slot must go through that resolution, otherwise
 * a total silently renders with the chart-level `defaultFormatter` instead -- so
 * a $300 total shows up as a bare "300.00".
 *
 * Two metrics with deliberately different formatters make a wrong pick obvious:
 * the assertions below read correctly only when each cell uses its own metric's
 * formatter rather than the other metric's or the default.
 */
const currencyFmt = (x: number) => `$${x.toFixed(2)}`;
const rateFmt = (x: number) => `${x.toFixed(3)} r`;
const defaultFmt = (x: number) => x.toFixed(2);

// Keyed exactly as PivotTableChart builds `metricFormatters`: METRIC_KEY first,
// then metric name.
const perMetricFormatters = {
  Metric: { sales: currencyFmt, rate: rateFmt },
};

const buildPivot = (data: Record<string, unknown>[]) =>
  new PivotData(
    {
      data,
      rows: ['color'],
      cols: ['Metric'],
      vals: ['value'],
      defaultFormatter: defaultFmt,
      customFormatters: perMetricFormatters,
    } as unknown as Record<string, unknown>,
    { colEnabled: true, rowEnabled: true },
  );

const rendered = (pivotData: PivotData, rowKey: string[], colKey: string[]) => {
  const agg = pivotData.getAggregator(rowKey, colKey);
  return agg.format(agg.value(), agg);
};

/**
 * Single metric, so every total unambiguously belongs to `sales` and must be
 * currency-formatted. Multi-metric grand totals are a separate question (which
 * metric a cross-metric total belongs to is #44725, not this issue).
 */
const SINGLE_METRIC_DATA = [
  {
    color: 'blue',
    Metric: 'sales',
    value: 100,
    __rows: ['color'],
    __columns: ['Metric'],
    __metricKey: 'Metric',
  },
  {
    color: 'red',
    Metric: 'sales',
    value: 200,
    __rows: ['color'],
    __columns: ['Metric'],
    __metricKey: 'Metric',
  },
  {
    Metric: 'sales',
    value: 300,
    __rows: [],
    __columns: ['Metric'],
    __metricKey: 'Metric',
  },
  { Metric: 'sales', value: 300, __rows: [], __columns: [] },
];

type TaggedRecord = Record<string, unknown>;

/**
 * Drop the explicit grand-total record -- the one tagged with an empty row *and*
 * column rollup. Selecting on those tags rather than a position keeps the
 * metric-collapse test correct if records are appended to or reordered in the
 * shared fixture.
 */
const withoutGrandTotalRecord = (records: TaggedRecord[]): TaggedRecord[] =>
  records.filter(
    record =>
      (record.__rows as string[]).length > 0 ||
      (record.__columns as string[]).length > 0,
  );

const isGrandTotalRecord = (record: TaggedRecord) =>
  (record.__rows as string[]).length === 0 &&
  (record.__columns as string[]).length === 0;

test('grand total uses the metric formatter, not the default formatter', () => {
  const pivotData = buildPivot(SINGLE_METRIC_DATA);

  // The body cell and the column total already resolve per-metric...
  expect(rendered(pivotData, ['blue'], ['sales'])).toBe('$100.00');
  expect(rendered(pivotData, [], ['sales'])).toBe('$300.00');
  // ...and the grand total is the same `sales` value, so it must match.
  // Before the fix this was "300.00" -- defaultFormatter, the reported bug.
  expect(rendered(pivotData, [], [])).toBe('$300.00');
});

test('metric-collapse total uses the metric formatter', () => {
  // No rollup level produces an empty key on the metric axis, so the collapsed
  // total is mirrored into rowTotals/allTotal from the metric-only records.
  // Removing the grand-total record from the shared fixture is exactly that case.
  const fixture = withoutGrandTotalRecord(SINGLE_METRIC_DATA);
  // The whole point of this test is that the grand total arrives via the mirror
  // and not from a record, so assert the fixture really is in that shape --
  // otherwise dropping the wrong record would leave the test silently green.
  expect(fixture.some(isGrandTotalRecord)).toBe(false);
  const pivotData = buildPivot(fixture);

  // There is no explicit rows=[]/columns=[] record here, so the grand total is
  // fed purely by the metric-collapse mirror -- and it still has to pick up the
  // metric's formatter.
  expect(rendered(pivotData, [], [])).toBe('$300.00');
  // The per-row total is deliberately left alone: it spans the whole metric
  // axis, so `getFormattedAggregator` falls back to the default formatter there.
  // With several metrics on that axis no single formatter is correct, and
  // picking one anyway is the mixed-metric-total question tracked by #44725.
  expect(rendered(pivotData, ['blue'], [])).toBe('100.00');
});

test('each aggregation cell uses the formatter of its own metric', () => {
  const pivotData = buildPivot([
    {
      color: 'blue',
      Metric: 'sales',
      value: 100,
      __rows: ['color'],
      __columns: ['Metric'],
      __metricKey: 'Metric',
    },
    {
      color: 'blue',
      Metric: 'rate',
      value: 5,
      __rows: ['color'],
      __columns: ['Metric'],
      __metricKey: 'Metric',
    },
    {
      Metric: 'sales',
      value: 100,
      __rows: [],
      __columns: ['Metric'],
      __metricKey: 'Metric',
    },
    {
      Metric: 'rate',
      value: 5,
      __rows: [],
      __columns: ['Metric'],
      __metricKey: 'Metric',
    },
  ]);

  // Column totals, one per metric: neither may borrow the other's formatter.
  expect(rendered(pivotData, [], ['sales'])).toBe('$100.00');
  expect(rendered(pivotData, [], ['rate'])).toBe('5.000 r');
  // Body cells, same rule.
  expect(rendered(pivotData, ['blue'], ['sales'])).toBe('$100.00');
  expect(rendered(pivotData, ['blue'], ['rate'])).toBe('5.000 r');
});

/**
 * Which metric a multi-metric grand total belongs to is #44725's question, and
 * this PR does not settle it. What must never happen is the slot being built
 * once from the first metric and then going on to render the *last* metric's
 * value in the *first* metric's format -- a regression that reads as correct
 * formatting of a plainly wrong number.
 *
 * Whichever metric's value the slot ends up showing, it has to be formatted as
 * that same metric. Asserted for both orders, since `push` overwrites the stored
 * value and the last record wins.
 */
test.each([
  ['sales first', ['sales', 'rate'], '5.000 r'],
  ['rate first', ['rate', 'sales'], '$300.00'],
])(
  'multi-metric grand total formats the value it shows as that metric (%s)',
  (_label, order, expected) => {
    const grandTotals: Record<string, number> = { sales: 300, rate: 5 };
    const pivotData = buildPivot(
      order.map(metric => ({
        Metric: metric,
        value: grandTotals[metric],
        __rows: [],
        __columns: [],
        __metricKey: 'Metric',
      })),
    );

    // The value is the last record's; the formatter has to be that metric's too.
    const agg = pivotData.getAggregator([], []);
    expect(agg.value()).toBe(grandTotals[order[order.length - 1]]);
    expect(agg.format(agg.value(), agg)).toBe(expected);
  },
);

test('a total with no per-metric formatter still falls back to the default', () => {
  const pivotData = new PivotData({
    data: SINGLE_METRIC_DATA,
    rows: ['color'],
    cols: ['Metric'],
    vals: ['value'],
    defaultFormatter: defaultFmt,
  } as unknown as Record<string, unknown>);

  expect(rendered(pivotData, [], [])).toBe('300.00');
});
