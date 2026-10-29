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
import { supersetTheme } from '@apache-superset/core/theme';
import { estimateWrappedLegendRowCount } from './legendLayout';

test('a single short name fits on one row', () => {
  expect(
    estimateWrappedLegendRowCount({
      names: ['A'],
      availableWidth: 800,
      theme: supersetTheme,
    }),
  ).toBe(1);
});

test('an empty legend still reports one row', () => {
  expect(
    estimateWrappedLegendRowCount({
      names: [],
      availableWidth: 800,
      theme: supersetTheme,
    }),
  ).toBe(1);
});

test('wraps onto more rows as names are added past the available width', () => {
  const names = Array.from({ length: 30 }, (_, i) => `series-${i}`);
  const rows = estimateWrappedLegendRowCount({
    names,
    availableWidth: 400,
    theme: supersetTheme,
  });
  expect(rows).toBeGreaterThan(1);

  // The same names fit onto fewer (or equal) rows given more width.
  const widerRows = estimateWrappedLegendRowCount({
    names,
    availableWidth: 4000,
    theme: supersetTheme,
  });
  expect(widerRows).toBeLessThanOrEqual(rows);
});

test('longer names wrap sooner than shorter ones at the same width', () => {
  const shortNames = Array.from({ length: 10 }, (_, i) => `${i}`);
  const longNames = Array.from(
    { length: 10 },
    (_, i) => `a much longer series label ${i}`,
  );
  const shortRows = estimateWrappedLegendRowCount({
    names: shortNames,
    availableWidth: 500,
    theme: supersetTheme,
  });
  const longRows = estimateWrappedLegendRowCount({
    names: longNames,
    availableWidth: 500,
    theme: supersetTheme,
  });
  expect(longRows).toBeGreaterThan(shortRows);
});
