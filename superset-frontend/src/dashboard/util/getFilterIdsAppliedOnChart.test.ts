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

import { getFilterIdsAppliedOnChart } from './getFilterIdsAppliedOnChart';
import { ActiveFilters } from '../types';

describe('getFilterIdsAppliedOnChart', () => {
  const createMockActiveFilters = (
    filterConfigs: Array<{ id: string; scope: number[] }>,
  ): ActiveFilters => {
    const activeFilters: ActiveFilters = {};
    filterConfigs.forEach(({ id, scope }) => {
      activeFilters[id] = {
        scope,
        targets: [],
        values: {},
      };
    });
    return activeFilters;
  };

  test('returns filters that include chart in their scope', () => {
    const activeFilters = createMockActiveFilters([
      { id: 'filter-1', scope: [1, 2, 3] },
      { id: 'filter-2', scope: [2, 4, 5] },
      { id: 'filter-3', scope: [1, 3, 6] },
    ]);

    const result = getFilterIdsAppliedOnChart(activeFilters, 2);
    expect(result).toEqual(['filter-1', 'filter-2']);
  });

  test('returns empty array when no filters apply to chart', () => {
    const activeFilters = createMockActiveFilters([
      { id: 'filter-1', scope: [1, 3, 5] },
      { id: 'filter-2', scope: [7, 8, 9] },
    ]);

    const result = getFilterIdsAppliedOnChart(activeFilters, 2);
    expect(result).toEqual([]);
  });

  test('returns empty array when activeFilters is empty', () => {
    const activeFilters: ActiveFilters = {};
    const result = getFilterIdsAppliedOnChart(activeFilters, 1);
    expect(result).toEqual([]);
  });

  test('handles single filter with single chart scope', () => {
    const activeFilters = createMockActiveFilters([
      { id: 'single-filter', scope: [42] },
    ]);

    const result = getFilterIdsAppliedOnChart(activeFilters, 42);
    expect(result).toEqual(['single-filter']);
  });

  test('handles multiple filters all applying to same chart', () => {
    const activeFilters = createMockActiveFilters([
      { id: 'filter-a', scope: [1, 2] },
      { id: 'filter-b', scope: [1] },
      { id: 'filter-c', scope: [1, 3, 4] },
    ]);

    const result = getFilterIdsAppliedOnChart(activeFilters, 1);
    expect(result).toEqual(['filter-a', 'filter-b', 'filter-c']);
  });

  test('preserves filter ID order from Object.entries', () => {
    const activeFilters = createMockActiveFilters([
      { id: 'zebra', scope: [1] },
      { id: 'alpha', scope: [1] },
      { id: 'beta', scope: [1] },
    ]);

    const result = getFilterIdsAppliedOnChart(activeFilters, 1);
    // Object.entries preserves insertion order in modern JS
    expect(result).toEqual(['zebra', 'alpha', 'beta']);
  });

  test('handles edge case with large chart IDs', () => {
    const activeFilters = createMockActiveFilters([
      { id: 'filter-large', scope: [999999, 1000000, 1000001] },
    ]);

    const result = getFilterIdsAppliedOnChart(activeFilters, 1000000);
    expect(result).toEqual(['filter-large']);
  });
});
