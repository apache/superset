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
 * Regression coverage for memoize-one v6 adoption.
 *
 * memoize-one v6 changed the signature of the (optional) custom `isEqual`
 * callback from per-argument `(a, b) => bool` to arg-array
 * `(newArgs, lastArgs) => bool`. Of the four memoizeOne callsites in
 * `src/transformProps.ts` (`processComparisonDataRecords`,
 * `processDataRecords`, `processColumns`, `getBasicColorFormatter`), only
 * `processColumns` passes a custom comparator (`isEqualColumns`); its
 * signature already takes arg-arrays and is compatible with v6. The other
 * three rely on memoize-one's default referential-equality comparator, which
 * is unchanged between v5 and v6.
 *
 * These tests lock those assumptions in by observing the memoization
 * behavior through the public `transformProps` API: identical chart-props
 * input references should produce referentially-equal `data` and `columns`
 * arrays (cache hit), while inputs that differ on the sub-fields each
 * memoizer actually compares should produce fresh arrays (cache miss).
 */
import transformProps from '../src/transformProps';
import testData from '../../plugin-chart-table/test/testData';

test('transformProps returns referentially-equal data/columns on identical input (cache hit)', () => {
  // processColumns and processDataRecords are both wrapped by memoizeOne at
  // module scope. Two consecutive calls with the same chartProps reference
  // should hit both caches and yield the same output references.
  const first = transformProps(testData.basic);
  const second = transformProps(testData.basic);

  expect(second.columns).toBe(first.columns);
  expect(second.data).toBe(first.data);
});

test('transformProps busts its memoization caches when sub-field inputs change (cache miss)', () => {
  const first = transformProps(testData.basic);

  // `processColumns` is wrapped with a custom equality (`isEqualColumns`) that
  // compares specific chartProps sub-fields by identity — mutating only the
  // top-level props reference is NOT enough to bust it. Here we supply a fresh
  // `datasource.columnFormats` reference, which `isEqualColumns` compares with
  // `===`, forcing `processColumns` to recompute and return a new `columns`
  // array.
  //
  // `processDataRecords` uses memoize-one's default referential equality on
  // `(data, columns)`. We also hand it a fresh `queriesData[0].data` array, so
  // together with the recomputed `columns` reference it too cache-misses.
  const freshProps = {
    ...testData.basic,
    datasource: {
      ...testData.basic.datasource,
      columnFormats: {},
    },
    queriesData: [
      {
        ...testData.basic.queriesData[0],
        data: [...(testData.basic.queriesData[0].data || [])],
      },
    ],
  };
  const second = transformProps(freshProps);

  expect(second.columns).not.toBe(first.columns);
  expect(second.data).not.toBe(first.data);
});

test('transformProps memoizes the comparison-mode data pipeline on identical input', () => {
  // Exercises `processComparisonDataRecords` (the third of four memoizeOne
  // callsites in transformProps.ts) via the `comparison` fixture, which has
  // `time_compare` set and therefore flows through the comparison branch
  // where `passedData = comparisonData`.
  //
  // Note: we don't assert reference equality on `columns` here because the
  // comparison branch runs `comparisonColumns` through the non-memoized
  // `processComparisonColumns` helper, which returns a fresh array on each
  // call by design.
  const first = transformProps(testData.comparison);
  const second = transformProps(testData.comparison);

  expect(second.data).toBe(first.data);
});
