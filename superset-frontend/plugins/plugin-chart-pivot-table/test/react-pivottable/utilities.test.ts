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

import { aggregators } from '../../src/react-pivottable/utilities';
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
