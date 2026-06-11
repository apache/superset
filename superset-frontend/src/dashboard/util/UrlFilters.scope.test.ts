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
 * Pinning test for the unmatched-Rison-filter wiring (PR review item #1).
 *
 * The reviewer flagged that unmatched URL filters were being written to
 * dataMask under a key (`__rison_filters__`) that no downstream code reads —
 * so unmatched filters silently dropped instead of applying to charts.
 *
 * The fix uses a synthetic dataMask id (`RISON_UNMATCHED_DATAMASK_ID`) whose
 * `extraFormData.filters` falls through to `getAllActiveFilters`'s
 * `allSliceIds` scope fallback, hitting every chart on the dashboard. This
 * test pins down that contract so a future refactor of `getAllActiveFilters`
 * can't silently break the wiring again.
 */
import { DataMaskStateWithId } from '@superset-ui/core';
import { getAllActiveFilters } from './activeAllDashboardFilters';
import {
  RISON_UNMATCHED_DATAMASK_ID,
  risonFiltersToExtraFormDataFilters,
} from './risonFilters';

test('synthetic Rison-unmatched dataMask entry scopes to every chart', () => {
  const allSliceIds = [101, 202, 303];
  const dataMask: DataMaskStateWithId = {
    [RISON_UNMATCHED_DATAMASK_ID]: {
      id: RISON_UNMATCHED_DATAMASK_ID,
      extraFormData: {
        filters: risonFiltersToExtraFormDataFilters([
          { subject: 'region', operator: '==', comparator: 'EMEA' },
        ]),
      },
      filterState: {},
      ownState: {},
    },
  };

  const activeFilters = getAllActiveFilters({
    chartConfiguration: {},
    nativeFilters: {}, // no native filter claims the synthetic id
    dataMask,
    allSliceIds,
  });

  const entry = activeFilters[RISON_UNMATCHED_DATAMASK_ID];
  expect(entry).toBeDefined();
  // Scope MUST equal allSliceIds — that's the whole reason this works.
  expect(entry.scope).toEqual(allSliceIds);
  // And the filters must be in the {col, op, val} shape getExtraFormData merges.
  expect(entry.values).toEqual({
    filters: [{ col: 'region', op: 'IN', val: ['EMEA'] }],
  });
});

test('synthetic entry coexists with real native filters without overlap', () => {
  const allSliceIds = [1, 2, 3];
  const dataMask: DataMaskStateWithId = {
    NATIVE_FILTER_country: {
      id: 'NATIVE_FILTER_country',
      extraFormData: {
        filters: [{ col: 'country', op: 'IN', val: ['USA'] }],
      },
      filterState: { value: ['USA'] },
      ownState: {},
    },
    [RISON_UNMATCHED_DATAMASK_ID]: {
      id: RISON_UNMATCHED_DATAMASK_ID,
      extraFormData: {
        filters: [{ col: 'region', op: 'IN', val: ['EMEA'] }],
      },
      filterState: {},
      ownState: {},
    },
  };

  const activeFilters = getAllActiveFilters({
    chartConfiguration: {},
    nativeFilters: {
      NATIVE_FILTER_country: {
        id: 'NATIVE_FILTER_country',
        chartsInScope: [1], // native filter is narrow
        targets: [{ column: { name: 'country' } }],
        filterType: 'filter_select',
      },
    },
    dataMask,
    allSliceIds,
  });

  // Native filter keeps its narrow scope.
  expect(activeFilters.NATIVE_FILTER_country.scope).toEqual([1]);
  // Synthetic filter scopes to all slices.
  expect(activeFilters[RISON_UNMATCHED_DATAMASK_ID].scope).toEqual(allSliceIds);
});
