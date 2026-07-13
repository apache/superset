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
  filterCanBeDependencyParent,
  filterCanHaveDependencies,
} from './useFilterOperations';

const items: Record<string, { value: Record<string, unknown> }> = {
  filter_select: {
    value: {
      behaviors: ['NATIVE_FILTER'],
      supportsCascadeDependencies: true,
    },
  },
  filter_timegrain: {
    value: {
      behaviors: ['NATIVE_FILTER'],
      supportsCascadeDependencies: false,
    },
  },
  filter_unspecified: {
    value: {
      behaviors: ['NATIVE_FILTER'],
    },
  },
  chart_only: {
    value: {
      behaviors: ['INTERACTIVE_CHART'],
    },
  },
};

jest.mock('@superset-ui/core', () => ({
  ...jest.requireActual('@superset-ui/core'),
  getChartMetadataRegistry: () => ({
    get: (key: string) => items[key]?.value,
  }),
}));

test('filterCanBeDependencyParent respects an explicit supportsCascadeDependencies opt-out', () => {
  expect(filterCanBeDependencyParent('filter_timegrain')).toBe(false);
});

test('filterCanBeDependencyParent respects an explicit supportsCascadeDependencies opt-in', () => {
  expect(filterCanBeDependencyParent('filter_select')).toBe(true);
});

test('filterCanBeDependencyParent falls back to NativeFilter behavior when unset', () => {
  expect(filterCanBeDependencyParent('filter_unspecified')).toBe(true);
  expect(filterCanBeDependencyParent('chart_only')).toBe(false);
});

test('filterCanBeDependencyParent returns false for an unknown or missing filterType', () => {
  expect(filterCanBeDependencyParent('unknown_type')).toBe(false);
  expect(filterCanBeDependencyParent(undefined)).toBe(false);
});

test('filterCanHaveDependencies is unaffected by a supportsCascadeDependencies opt-out', () => {
  // filter_timegrain can't be a cascade *parent*, but it can still be a *child*
  // that depends on other filters — these are independent capabilities.
  expect(filterCanHaveDependencies('filter_timegrain')).toBe(true);
});

test('filterCanHaveDependencies requires NativeFilter behavior', () => {
  expect(filterCanHaveDependencies('filter_select')).toBe(true);
  expect(filterCanHaveDependencies('chart_only')).toBe(false);
});

test('filterCanHaveDependencies returns false for an unknown or missing filterType', () => {
  expect(filterCanHaveDependencies('unknown_type')).toBe(false);
  expect(filterCanHaveDependencies(undefined)).toBe(false);
});
