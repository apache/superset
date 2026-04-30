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
import { renderHook } from '@testing-library/react';
import { Provider } from 'react-redux';
import configureStore from 'redux-mock-store';
import { createElement } from 'react';
import type { ReactNode } from 'react';
import type {
  DataMaskStateWithId,
  QueryObjectFilterClause,
} from '@superset-ui/core';
import {
  FilterConfigMap,
  resolveTransitiveParentIds,
} from '../../dependencyGraph';
import { useFilterDependencies, useTransitiveParentIds } from './state';

const mockStore = configureStore([]);

const buildWrapper = (filters: FilterConfigMap) => {
  const store = mockStore({ nativeFilters: { filters } });
  return ({ children }: { children: ReactNode }) =>
    createElement(Provider, { store }, children);
};

test('resolveTransitiveParentIds returns empty for a filter with no parents', () => {
  expect(
    resolveTransitiveParentIds('A', {
      A: { cascadeParentIds: [] },
    }),
  ).toEqual([]);
});

test('resolveTransitiveParentIds walks a linear chain A -> B -> C -> D', () => {
  // D depends on C, C on B, B on A; each level only lists its direct parent.
  const result = resolveTransitiveParentIds('D', {
    A: { cascadeParentIds: [] },
    B: { cascadeParentIds: ['A'] },
    C: { cascadeParentIds: ['B'] },
    D: { cascadeParentIds: ['C'] },
  });
  // Furthest ancestor first, closest parent last.
  expect(result).toEqual(['A', 'B', 'C']);
});

test('resolveTransitiveParentIds deduplicates shared ancestors in a diamond', () => {
  //      A
  //    /  \
  //   B    C
  //    \  /
  //     D
  const result = resolveTransitiveParentIds('D', {
    A: { cascadeParentIds: [] },
    B: { cascadeParentIds: ['A'] },
    C: { cascadeParentIds: ['A'] },
    D: { cascadeParentIds: ['B', 'C'] },
  });
  expect(result).toContain('A');
  expect(result).toContain('B');
  expect(result).toContain('C');
  // A should only appear once even though reachable via B and C.
  expect(result.filter(id => id === 'A')).toHaveLength(1);
});

test('resolveTransitiveParentIds defends against cyclic configuration', () => {
  // Filter config modal enforces acyclicity, but malformed saved state
  // should not spin forever here.
  const result = resolveTransitiveParentIds('A', {
    A: { cascadeParentIds: ['B'] },
    B: { cascadeParentIds: ['A'] },
  });
  expect(result).toEqual(['B']);
});

test('resolveTransitiveParentIds tolerates missing filter entries', () => {
  // Unknown parent id referenced in cascadeParentIds should not crash.
  expect(
    resolveTransitiveParentIds('X', {
      X: { cascadeParentIds: ['Y'] },
    }),
  ).toEqual(['Y']);
});

test('useTransitiveParentIds reads filter config from redux', () => {
  const wrapper = buildWrapper({
    A: { cascadeParentIds: [] },
    B: { cascadeParentIds: ['A'] },
    C: { cascadeParentIds: ['B'] },
  });
  const { result } = renderHook(() => useTransitiveParentIds('C'), { wrapper });
  expect(result.current).toEqual(['A', 'B']);
});

test('useFilterDependencies merges extraFormData across the full chain', () => {
  // Regression test for sc-102912: a chain A -> B -> C -> D where each level
  // only lists its direct parent must still produce extra_form_data that
  // includes clauses from every ancestor, not just the closest parent.
  const wrapper = buildWrapper({
    A: { cascadeParentIds: [] },
    B: { cascadeParentIds: ['A'] },
    C: { cascadeParentIds: ['B'] },
    D: { cascadeParentIds: ['C'] },
  });
  const dataMaskSelected: DataMaskStateWithId = {
    A: {
      id: 'A',
      extraFormData: { filters: [{ col: 'country', op: 'IN', val: ['US'] }] },
    },
    B: {
      id: 'B',
      extraFormData: { filters: [{ col: 'region', op: 'IN', val: ['West'] }] },
    },
    C: {
      id: 'C',
      extraFormData: { filters: [{ col: 'state', op: 'IN', val: ['CA'] }] },
    },
  };
  const { result } = renderHook(
    () => useFilterDependencies('D', dataMaskSelected),
    { wrapper },
  );
  const cols = (
    (result.current.filters ?? []) as QueryObjectFilterClause[]
  ).map(f => f.col);
  // All three ancestor clauses must be present.
  expect(cols).toEqual(expect.arrayContaining(['country', 'region', 'state']));
  expect(result.current.filters ?? []).toHaveLength(3);
});

test('useFilterDependencies lets the closest ancestor override scalar fields', () => {
  // `mergeExtraFormData` appends filter arrays but overrides scalar fields
  // like `time_range`. Topological order must put the closest parent last so
  // its scalar overrides win over further ancestors.
  const wrapper = buildWrapper({
    A: { cascadeParentIds: [] },
    B: { cascadeParentIds: ['A'] },
    C: { cascadeParentIds: ['B'] },
  });
  const dataMaskSelected: DataMaskStateWithId = {
    A: {
      id: 'A',
      extraFormData: { time_range: 'Last year' },
    },
    B: {
      id: 'B',
      extraFormData: { time_range: 'Last month' },
    },
  };
  const { result } = renderHook(
    () => useFilterDependencies('C', dataMaskSelected),
    { wrapper },
  );
  // B is C's closest ancestor with a time_range, so it should win over A.
  expect(result.current.time_range).toBe('Last month');
});

test('useFilterDependencies returns empty object when parent state is missing', () => {
  const wrapper = buildWrapper({
    A: { cascadeParentIds: [] },
    B: { cascadeParentIds: ['A'] },
  });
  const { result } = renderHook(() => useFilterDependencies('B', {}), {
    wrapper,
  });
  expect(result.current).toEqual({});
});
