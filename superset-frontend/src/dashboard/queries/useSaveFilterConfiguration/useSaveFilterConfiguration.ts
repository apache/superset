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
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useDispatch } from 'react-redux';
import { Filter, Filters, makeApi } from '@superset-ui/core';
import { t } from '@apache-superset/core/translation';
import { useToasts } from 'src/components/MessageToasts/withToasts';
import { setDataMaskForFilterChangesComplete } from 'src/dataMask/actions';
import {
  useNativeFiltersStore,
  useDashboardInfoStore,
  type FilterEntry,
} from 'src/dashboard/stores';
import { rebaselineHydrationDashboardInfo } from 'src/dashboard/util/rebaselineHydrationDashboardInfo';
import { SaveFilterChangesType } from 'src/dashboard/components/nativeFilters/FiltersConfigModal/types';
import { dashboardKeys } from '../keys';

const isFilterChangesEmpty = (filterChanges: SaveFilterChangesType) =>
  Object.values(filterChanges).every(
    array => Array.isArray(array) && !array.length,
  );

/** Persists native filter configuration changes for the dashboard. */
export function useSaveFilterConfiguration() {
  const dispatch = useDispatch();
  const { addDangerToast } = useToasts();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (filterChanges: SaveFilterChangesType) => {
      if (isFilterChangesEmpty(filterChanges)) {
        return undefined;
      }
      const { id } = useDashboardInfoStore.getState().dashboardInfo;
      const oldFilters = useNativeFiltersStore.getState().filters as Filters;
      const updateFilters = makeApi<
        SaveFilterChangesType,
        { result: Filter[] }
      >({
        method: 'PUT',
        endpoint: `/api/v1/dashboard/${id}/filters`,
      });
      const response = await updateFilters(filterChanges);
      return { id, response, filterChanges, oldFilters };
    },
    onSuccess: result => {
      if (!result) return;
      const { id, response, filterChanges, oldFilters } = result;
      useNativeFiltersStore
        .getState()
        .setFiltersConfigComplete(
          response.result as FilterEntry[],
          filterChanges.deleted,
        );
      useDashboardInfoStore.getState().setNativeFiltersConfig(response.result);
      dispatch(setDataMaskForFilterChangesComplete(filterChanges, oldFilters));
      queryClient.invalidateQueries({ queryKey: dashboardKeys.detail(id) });
      // Refresh only dashboardInfo (the new filter config); a filter-config save
      // doesn't persist layout/state, so don't rebaseline those into the snapshot.
      rebaselineHydrationDashboardInfo(id);
    },
    onError: () => {
      addDangerToast(t('Failed to save filter changes'));
    },
  });
}
