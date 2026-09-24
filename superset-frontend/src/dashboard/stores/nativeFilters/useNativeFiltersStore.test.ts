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
  useNativeFiltersStore,
  getNativeFiltersInitialState,
  type FilterEntry,
} from './useNativeFiltersStore';

const store = useNativeFiltersStore;

const filter = (
  id: string,
  overrides: Partial<FilterEntry> = {},
): FilterEntry => ({ id, ...overrides }) as FilterEntry;

beforeEach(() => {
  store.setState({
    filters: {},
    focusedFilterId: undefined,
    hoveredFilterId: undefined,
    hoveredChartCustomizationId: undefined,
  });
});

test('has correct initial state', () => {
  expect(store.getState().filters).toEqual({});
  expect(store.getState().focusedFilterId).toBeUndefined();
  expect(store.getState().hoveredFilterId).toBeUndefined();
  expect(store.getState().hoveredChartCustomizationId).toBeUndefined();
});

test('setFocusedFilter / unsetFocusedFilter', () => {
  store.getState().setFocusedFilter('NATIVE_FILTER-1');
  expect(store.getState().focusedFilterId).toBe('NATIVE_FILTER-1');
  store.getState().unsetFocusedFilter();
  expect(store.getState().focusedFilterId).toBeUndefined();
});

test('setHoveredFilter / unsetHoveredFilter', () => {
  store.getState().setHoveredFilter('NATIVE_FILTER-2');
  expect(store.getState().hoveredFilterId).toBe('NATIVE_FILTER-2');
  store.getState().unsetHoveredFilter();
  expect(store.getState().hoveredFilterId).toBeUndefined();
});

test('setHoveredChartCustomization / unsetHoveredChartCustomization', () => {
  store.getState().setHoveredChartCustomization('CC-1');
  expect(store.getState().hoveredChartCustomizationId).toBe('CC-1');
  store.getState().unsetHoveredChartCustomization();
  expect(store.getState().hoveredChartCustomizationId).toBeUndefined();
});

test('updateCascadeParentIds sets parent ids on an existing filter', () => {
  store.setState({ filters: { A: filter('A') } });
  store.getState().updateCascadeParentIds('A', ['B', 'C']);
  expect(
    (store.getState().filters.A as FilterEntry & { cascadeParentIds: string[] })
      .cascadeParentIds,
  ).toEqual(['B', 'C']);
});

test('setFiltersConfigComplete merges into existing filters without dropping other domains', () => {
  // #42032: native filters and chart customizations share this map, but each
  // save reports only its own domain. Merging (not rebuilding) keeps the other
  // domain's entries instead of dropping them.
  store.setState({ filters: { other: filter('other') } });
  store
    .getState()
    .setFiltersConfigComplete([
      filter('A', { chartsInScope: [1], tabsInScope: ['T1'] }),
    ]);
  expect(Object.keys(store.getState().filters).sort()).toEqual(['A', 'other']);
});

test('setFiltersConfigComplete removes entries listed in deletedIds', () => {
  store.setState({ filters: { A: filter('A'), B: filter('B') } });
  store.getState().setFiltersConfigComplete([filter('A')], ['B']);
  expect(Object.keys(store.getState().filters)).toEqual(['A']);
});

test('setFiltersConfigComplete preserves scope from the existing filter when absent', () => {
  store.setState({
    filters: { A: filter('A', { chartsInScope: [9], tabsInScope: ['T9'] }) },
  });
  store.getState().setFiltersConfigComplete([filter('A')]);
  const merged = store.getState().filters.A as FilterEntry & {
    chartsInScope: number[];
    tabsInScope: string[];
  };
  expect(merged.chartsInScope).toEqual([9]);
  expect(merged.tabsInScope).toEqual(['T9']);
});

test('setFiltersConfigComplete clears a focus/hover id whose filter was removed', () => {
  store.setState({
    filters: { A: filter('A') },
    focusedFilterId: 'A',
    hoveredFilterId: 'A',
  });
  store.getState().setFiltersConfigComplete([filter('B')], ['A']);
  expect(Object.keys(store.getState().filters)).toEqual(['B']);
  expect(store.getState().focusedFilterId).toBeUndefined();
  expect(store.getState().hoveredFilterId).toBeUndefined();
});

test('setFiltersConfigComplete keeps a focus/hover id whose filter still exists', () => {
  store.setState({
    filters: { A: filter('A') },
    focusedFilterId: 'A',
    hoveredFilterId: 'A',
  });
  store.getState().setFiltersConfigComplete([filter('A'), filter('B')]);
  expect(store.getState().focusedFilterId).toBe('A');
  expect(store.getState().hoveredFilterId).toBe('A');
});

test('setInScopeStatus merges scoped filters into existing state', () => {
  store.setState({ filters: { A: filter('A'), B: filter('B') } });
  store
    .getState()
    .setInScopeStatus([filter('A', { chartsInScope: [1], tabsInScope: [] })]);
  expect(Object.keys(store.getState().filters).sort()).toEqual(['A', 'B']);
  expect(
    (store.getState().filters.A as FilterEntry & { chartsInScope: number[] })
      .chartsInScope,
  ).toEqual([1]);
});

test('hydrateNativeFilters replaces filters and clears transient ids', () => {
  store.setState({
    filters: { old: filter('old') },
    focusedFilterId: 'old',
    hoveredFilterId: 'old',
  });
  store.getState().hydrateNativeFilters({ A: filter('A') });
  expect(Object.keys(store.getState().filters)).toEqual(['A']);
  expect(store.getState().focusedFilterId).toBeUndefined();
  expect(store.getState().hoveredFilterId).toBeUndefined();
});

test('hydrateNativeFilters keeps existing scope when incoming filter lacks it', () => {
  store.setState({
    filters: { A: filter('A', { chartsInScope: [5], tabsInScope: ['T5'] }) },
  });
  store.getState().hydrateNativeFilters({ A: filter('A') });
  const merged = store.getState().filters.A as FilterEntry & {
    chartsInScope: number[];
  };
  expect(merged.chartsInScope).toEqual([5]);
});

test('getNativeFiltersInitialState builds filters from a config, preserving prior filters', () => {
  const result = getNativeFiltersInitialState({
    filterConfig: [filter('A'), filter('B')],
    state: {
      filters: { C: filter('C') },
      focusedFilterId: undefined,
      hoveredFilterId: undefined,
    },
  });
  expect(Object.keys(result.filters).sort()).toEqual(['A', 'B', 'C']);
  expect(result.focusedFilterId).toBeUndefined();
});

test('subscribeWithSelector fires on filters change', () => {
  const listener = jest.fn();
  const unsub = store.subscribe(s => s.focusedFilterId, listener);
  store.getState().setFocusedFilter('NATIVE_FILTER-9');
  expect(listener).toHaveBeenCalledWith('NATIVE_FILTER-9', undefined);
  unsub();
});
