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
import { Behavior } from '@superset-ui/core';
import {
  filterSupportsDependencies,
  useFilterOperations,
  FilterOperationsParams,
} from './useFilterOperations';

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

function renderFilterOperations(
  filters: Record<string, { filterType: string; dependencies?: string[] }>,
) {
  const params: FilterOperationsParams = {
    form: {
      getFieldValue: () => filters,
    } as unknown as FilterOperationsParams['form'],
    filterState: {
      removedItems: {},
    } as unknown as FilterOperationsParams['filterState'],
    filterIds: Object.keys(filters),
    filterConfigMap: {},
    handleModifyItem: jest.fn(),
    setActiveItem: jest.fn(),
    setSaveAlertVisible: jest.fn(),
  };
  return renderHook(() => useFilterOperations(params)).result;
}

test('buildDependencyMap drops a parent id whose filter type no longer supports dependencies', () => {
  // "parent" was a Select filter when "child" was configured to depend on
  // it, then the user changed "parent" to Time grain within the same
  // editing session (before saving) - the stale edge should not linger.
  const result = renderFilterOperations({
    parent: { filterType: 'filter_timegrain' },
    child: { filterType: 'filter_select', dependencies: ['parent'] },
  });

  const dependencyMap = result.current.buildDependencyMap();

  expect(dependencyMap.get('child')).toEqual([]);
});

test('buildDependencyMap keeps a parent id whose filter type still supports dependencies', () => {
  const result = renderFilterOperations({
    parent: { filterType: 'filter_select' },
    child: { filterType: 'filter_select', dependencies: ['parent'] },
  });

  const dependencyMap = result.current.buildDependencyMap();

  expect(dependencyMap.get('child')).toEqual(['parent']);
});
