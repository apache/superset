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

/**
 * Pivot-table acceptance cases for non-additive metric totals (see SIP.md).
 *
 * The pivot computes its grand total / subtotals client-side using the
 * `aggregators` from react-pivottable, applied to the already-aggregated cell
 * values. For a non-additive metric (a ratio like SUM(actual)/SUM(target))
 * that is wrong: summing the per-group ratios is meaningless. This pins the
 * mechanism behind #25747 / #32260 against the real production aggregator.
 *
 * The fix is not at this layer (no client-side aggregator over divided cells
 * can recover the right answer) - it requires the DB-computed per-level rollup
 * queries from phase 2. The `test.failing` case documents that target.
 */
import { aggregators } from '../../src/react-pivottable/utilities';

// Per-group completion ratios (actual/target), as the single pivot query
// returns them today.
const ratioCells = [{ completion: 10 / 40 }, { completion: 30 / 60 }]; // 0.25, 0.5

// Correct grand total: SUM(actual)/SUM(target) = 40/100 = 0.4
const CORRECT_COMPLETION = 0.4;

function sumOf(field: string, rows: Record<string, number>[]): number {
  // Build the real "Sum" aggregator the pivot uses for totals.
  const aggregator = (aggregators as Record<string, any>).Sum([field])(
    null,
    [],
    [],
  );
  rows.forEach(r => aggregator.push(r));
  return aggregator.value();
}

test('#25747/#32260: pivot Sum aggregator totals the per-group ratios (current, wrong)', () => {
  // 0.25 + 0.5 = 0.75, which is not a meaningful completion rate.
  expect(sumOf('completion', ratioCells)).toBeCloseTo(0.75);
  expect(sumOf('completion', ratioCells)).not.toBeCloseTo(CORRECT_COMPLETION);
});

test.failing(
  '#25747/#32260: the correct ratio is unreachable by client-side summation (justifies the query-layer fix)',
  () => {
    // This stays failing by design: no aggregator over the already-divided
    // cells can recover SUM(actual)/SUM(target). It documents *why* phase 2
    // moves totals to DB-computed per-level rollup queries rather than fixing
    // an aggregator. The phase-2 acceptance test lives at the data-flow layer
    // (transformProps consuming the rollup results), not here.
    expect(sumOf('completion', ratioCells)).toBeCloseTo(CORRECT_COMPLETION);
  },
);
