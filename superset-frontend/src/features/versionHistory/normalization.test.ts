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
import {
  automaticNormalizationTransitions,
  isJsonValue,
  matchingAutomaticNormalizationTransitions,
} from './normalization';

test('recognizes only values that JSON can represent faithfully', () => {
  expect(isJsonValue({ nested: [null, true, 3, 'value'] })).toBe(true);
  expect(isJsonValue(Number.NaN)).toBe(false);
  expect(isJsonValue(Number.POSITIVE_INFINITY)).toBe(false);
  expect(isJsonValue(new Date())).toBe(false);

  const cyclic: Record<string, unknown> = {};
  cyclic.self = cyclic;
  expect(isJsonValue(cyclic)).toBe(false);
});

test('records hydration changes only when input matches persisted data', () => {
  expect(
    automaticNormalizationTransitions(
      { row_limit: null },
      { row_limit: null },
      { row_limit: 10000, show_legend: true },
    ),
  ).toEqual({
    row_limit: {
      control: 'row_limit',
      from_present: true,
      from_value: null,
      to_present: true,
      to_value: 10000,
    },
    show_legend: {
      control: 'show_legend',
      from_present: false,
      to_present: true,
      to_value: true,
    },
  });

  expect(
    automaticNormalizationTransitions(
      { row_limit: null },
      { row_limit: 500 },
      { row_limit: 10000 },
    ),
  ).toEqual({});
});

test('does not interpret a missing hydrated control as normalization', () => {
  expect(
    automaticNormalizationTransitions(
      { obsolete_control: true },
      { obsolete_control: true },
      {},
    ),
  ).toEqual({});
});

test('keeps only valid, unchanged transitions for a save', () => {
  const rowLimit = {
    control: 'row_limit',
    from_present: true as const,
    from_value: null,
    to_present: true as const,
    to_value: 10000,
  };
  const tracking = {
    chartId: 7,
    hydrationSessionId: 'hydration-a',
    saveAttemptId: null,
    invalidatedControls: { show_legend: true as const },
    transitions: {
      row_limit: rowLimit,
      show_legend: {
        control: 'show_legend',
        from_present: false as const,
        to_present: true as const,
        to_value: true,
      },
    },
  };

  expect(
    matchingAutomaticNormalizationTransitions(tracking, {
      row_limit: 10000,
      show_legend: true,
    }),
  ).toEqual({ row_limit: rowLimit });
});
