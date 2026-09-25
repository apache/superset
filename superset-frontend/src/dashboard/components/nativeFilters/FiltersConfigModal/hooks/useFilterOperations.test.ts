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
import { useState } from 'react';
import { renderHook, act } from '@testing-library/react';
import { Behavior, Filter, Divider } from '@superset-ui/core';
import type { FormInstance } from '@superset-ui/core/components';
import {
  filterSupportsDependencies,
  useFilterOperations,
} from './useFilterOperations';
import { useItemStateManager } from './useItemStateManager';
import { NativeFiltersForm } from '../types';

const mockItems: Record<string, { value: Record<string, unknown> }> = {
  filter_select: {
    value: {
      behaviors: [Behavior.NativeFilter],
      supportsCascadeDependencies: true,
    },
  },
  filter_range: {
    value: {
      behaviors: [Behavior.NativeFilter],
      supportsCascadeDependencies: true,
    },
  },
  filter_time: {
    value: {
      behaviors: [Behavior.NativeFilter],
      supportsCascadeDependencies: true,
    },
  },
  filter_timegrain: {
    value: {
      behaviors: [Behavior.NativeFilter],
      supportsCascadeDependencies: false,
    },
  },
  filter_timecolumn: {
    value: {
      behaviors: [Behavior.NativeFilter],
      supportsCascadeDependencies: false,
    },
  },
  filter_unspecified: {
    value: {
      behaviors: [Behavior.NativeFilter],
    },
  },
  chart_only: {
    value: {
      behaviors: [Behavior.InteractiveChart],
    },
  },
};

jest.mock('@superset-ui/core', () => ({
  ...jest.requireActual('@superset-ui/core'),
  getChartMetadataRegistry: () => ({
    get: (key: string) => mockItems[key]?.value,
  }),
}));

test('filterSupportsDependencies opts in the core select/range/time filters', () => {
  expect(filterSupportsDependencies('filter_select')).toBe(true);
  expect(filterSupportsDependencies('filter_range')).toBe(true);
  expect(filterSupportsDependencies('filter_time')).toBe(true);
});

test('filterSupportsDependencies keeps time grain and time column out of the cascade gate', () => {
  expect(filterSupportsDependencies('filter_timegrain')).toBe(false);
  expect(filterSupportsDependencies('filter_timecolumn')).toBe(false);
});

test('filterSupportsDependencies falls back to NativeFilter behavior when unset', () => {
  expect(filterSupportsDependencies('filter_unspecified')).toBe(true);
  expect(filterSupportsDependencies('chart_only')).toBe(false);
});

test('filterSupportsDependencies returns false for an unknown or missing filterType', () => {
  expect(filterSupportsDependencies('unknown_type')).toBe(false);
  expect(filterSupportsDependencies(undefined)).toBe(false);
});

const buildCascadeConfigMap = (): Record<string, Filter | Divider> =>
  ({
    f1: { id: 'f1', filterType: 'filter_select', cascadeParentIds: [] },
    f2: { id: 'f2', filterType: 'filter_select', cascadeParentIds: [] },
    f3: { id: 'f3', filterType: 'filter_select', cascadeParentIds: [] },
  }) as unknown as Record<string, Filter | Divider>;

const buildDependencyForm = (
  dependenciesByFilter: Record<string, string[]>,
): FormInstance<NativeFiltersForm> => {
  const filters = Object.fromEntries(
    Object.keys(dependenciesByFilter).map(id => [
      id,
      { filterType: 'filter_select', dependencies: dependenciesByFilter[id] },
    ]),
  );
  return {
    getFieldValue: (field: string) =>
      field === 'filters' ? filters : undefined,
    setFields: jest.fn(),
  } as unknown as FormInstance<NativeFiltersForm>;
};

test('getAvailableFilters excludes a candidate that would create a circular dependency', () => {
  // f2 already depends on f1, so offering f2 as a dependency of f1 would cycle
  const form = buildDependencyForm({ f1: [], f2: ['f1'], f3: [] });
  const { result } = renderHook(() =>
    useFilterOperations({
      form,
      filterState: {
        removedItems: {},
      } as unknown as ReturnType<typeof useItemStateManager>,
      filterIds: ['f1', 'f2', 'f3'],
      filterConfigMap: buildCascadeConfigMap(),
      handleModifyItem: jest.fn(),
      setActiveItem: jest.fn(),
      setSaveAlertVisible: jest.fn(),
    }),
  );

  const availableIds = result.current
    .getAvailableFilters('f1', id => id)
    .map(option => option.value);

  expect(availableIds).toEqual(['f3']);
});

test('validateDependencies flags only the filters that participate in a cycle', () => {
  // f1 <-> f2 form a cycle; f3 has no dependencies
  const form = buildDependencyForm({ f1: ['f2'], f2: ['f1'], f3: [] });
  const { result } = renderHook(() =>
    useFilterOperations({
      form,
      filterState: {
        removedItems: {},
      } as unknown as ReturnType<typeof useItemStateManager>,
      filterIds: ['f1', 'f2', 'f3'],
      filterConfigMap: buildCascadeConfigMap(),
      handleModifyItem: jest.fn(),
      setActiveItem: jest.fn(),
      setSaveAlertVisible: jest.fn(),
    }),
  );

  act(() => {
    result.current.validateDependencies();
  });

  const setFieldsMock = form.setFields as jest.Mock;
  const errorsById: Record<string, unknown[]> = {};
  setFieldsMock.mock.calls.forEach(([[field]]) => {
    errorsById[field.name[1]] = field.errors;
  });

  expect(errorsById.f1.length).toBeGreaterThan(0);
  expect(errorsById.f2.length).toBeGreaterThan(0);
  expect(errorsById.f3).toEqual([]);
});

// Minimal state harness (rather than the full useItemStateManager) so these
// tests isolate handleRemoveFilter/restoreFilter's own timer handling,
// without useItemStateManager's independent removedItems cleanup effect
// masking a broken guard in the hook under test.
function useFilterOperationsHarness(
  filterIds: string[],
  form: FormInstance<NativeFiltersForm>,
) {
  const [removedItems, setRemovedItems] = useState<
    ReturnType<typeof useItemStateManager>['removedItems']
  >({});
  const [changes, setChanges] = useState<
    ReturnType<typeof useItemStateManager>['changes']
  >({ modified: [], deleted: [], reordered: [] });
  const filterState = {
    removedItems,
    setRemovedItems,
    changes,
    setChanges,
  } as unknown as ReturnType<typeof useItemStateManager>;
  const filterOperations = useFilterOperations({
    form,
    filterState,
    filterIds,
    filterConfigMap: {},
    handleModifyItem: jest.fn(),
    setActiveItem: jest.fn(),
    setSaveAlertVisible: jest.fn(),
  });
  return { filterState, filterOperations };
}

test('handleRemoveFilter finalizes the removal once the pending delay elapses', () => {
  jest.useFakeTimers();
  const form = {
    getFieldValue: () => undefined,
  } as unknown as FormInstance<NativeFiltersForm>;
  const { result } = renderHook(() => useFilterOperationsHarness(['f1'], form));

  act(() => {
    result.current.filterOperations.handleRemoveFilter('f1');
  });
  expect(result.current.filterState.removedItems.f1).toEqual(
    expect.objectContaining({ isPending: true }),
  );

  act(() => {
    jest.advanceTimersByTime(5000);
  });
  expect(result.current.filterState.removedItems.f1).toEqual({
    isPending: false,
  });

  jest.useRealTimers();
});

test('restoreFilter cancels the pending removal before the delay elapses', () => {
  jest.useFakeTimers();
  const form = {
    getFieldValue: () => undefined,
  } as unknown as FormInstance<NativeFiltersForm>;
  const { result } = renderHook(() => useFilterOperationsHarness(['f1'], form));

  act(() => {
    result.current.filterOperations.handleRemoveFilter('f1');
  });
  act(() => {
    result.current.filterOperations.restoreFilter('f1');
  });
  expect(result.current.filterState.removedItems.f1).toBeNull();

  act(() => {
    jest.advanceTimersByTime(5000);
  });
  // the timer was cancelled by the restore, so it never finalizes the removal
  expect(result.current.filterState.removedItems.f1).toBeNull();

  jest.useRealTimers();
});
