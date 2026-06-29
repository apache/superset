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
import {
  makeApi,
  getClientErrorObject,
  ChartCustomization,
  ChartCustomizationDivider,
  Filter,
  Filters,
} from '@superset-ui/core';
import { t } from '@apache-superset/core/translation';
import { useToasts } from 'src/components/MessageToasts/withToasts';
import { DashboardInfo } from 'src/dashboard/types';
import {
  removeDataMask,
  setDataMaskForFilterChangesComplete,
} from 'src/dataMask/actions';
import {
  useNativeFiltersStore,
  useDashboardInfoStore,
  type FilterEntry,
} from 'src/dashboard/stores';
import { rebaselineHydrationDashboardInfo } from 'src/dashboard/util/rebaselineHydrationDashboardInfo';
import { SaveFilterChangesType } from 'src/dashboard/components/nativeFilters/FiltersConfigModal/types';
import { dashboardKeys } from '../keys';

const createUpdateChartCustomizationsApi = (id: number) =>
  makeApi<
    {
      modified: (
        | (ChartCustomization & { cascadeParentIds: string[] })
        | ChartCustomizationDivider
      )[];
      deleted: string[];
      reordered?: string[];
    },
    { result: (ChartCustomization | ChartCustomizationDivider)[] }
  >({
    method: 'PUT',
    endpoint: `/api/v1/dashboard/${id}/chart_customizations`,
  });

interface SaveChartCustomizationVariables {
  modifiedCustomizations: (ChartCustomization | ChartCustomizationDivider)[];
  deletedIds: string[];
  reorderedIds?: string[];
  resetDataMask?: boolean;
}

/** Persists chart customization (dynamic group-by) changes for the dashboard. */
export function useSaveChartCustomization() {
  const dispatch = useDispatch();
  const { addDangerToast } = useToasts();
  const queryClient = useQueryClient();
  return useMutation<
    { result: Partial<DashboardInfo>; last_modified_time: number },
    unknown,
    SaveChartCustomizationVariables
  >({
    mutationFn: async ({
      modifiedCustomizations,
      deletedIds,
      reorderedIds = [],
      resetDataMask = false,
    }) => {
      const { id, metadata } = useDashboardInfoStore.getState().dashboardInfo;

      const modifiedItems = modifiedCustomizations.map(item => {
        if ('cascadeParentIds' in item) {
          return {
            ...item,
            cascadeParentIds: item.cascadeParentIds || [],
          } as ChartCustomization & { cascadeParentIds: string[] };
        }
        return item as ChartCustomizationDivider;
      });

      deletedIds.forEach((customizationId: string) => {
        dispatch(removeDataMask(customizationId));
      });

      const updateChartCustomizations = createUpdateChartCustomizationsApi(id);

      try {
        const response = await updateChartCustomizations({
          modified: modifiedItems,
          deleted: deletedIds,
          reordered: reorderedIds,
        });

        const currentMetadata =
          useDashboardInfoStore.getState().dashboardInfo.metadata;
        const currentConfig =
          currentMetadata?.chart_customization_config?.filter(Boolean) || [];

        const mergedResult = response.result.map(
          (item: ChartCustomization | ChartCustomizationDivider) => {
            const existing = currentConfig.find(
              (c: ChartCustomization | ChartCustomizationDivider) =>
                c.id === item.id,
            );
            if (!existing) {
              return item;
            }
            return {
              ...item,
              chartsInScope:
                (item as ChartCustomization).chartsInScope ??
                (existing as ChartCustomization).chartsInScope,
              tabsInScope:
                (item as ChartCustomization).tabsInScope ??
                (existing as ChartCustomization).tabsInScope,
              scope:
                (item as ChartCustomization).scope ??
                (existing as ChartCustomization).scope,
            };
          },
        );

        useNativeFiltersStore
          .getState()
          .setFiltersConfigComplete(mergedResult as FilterEntry[]);

        useDashboardInfoStore.getState().setDashboardInfo({
          metadata: {
            ...currentMetadata,
            chart_customization_config: mergedResult,
          },
        });
        rebaselineHydrationDashboardInfo(id);
        queryClient.invalidateQueries({ queryKey: dashboardKeys.detail(id) });

        if (resetDataMask) {
          const oldConfig =
            metadata?.chart_customization_config?.filter(Boolean) || [];
          const oldCustomizationsById = oldConfig.reduce<
            Record<string, ChartCustomization | ChartCustomizationDivider>
          >((acc, customization) => {
            acc[customization.id] = customization;
            return acc;
          }, {});

          const customizationFilterChanges: SaveFilterChangesType = {
            modified: modifiedCustomizations as unknown as Filter[],
            deleted: deletedIds,
            reordered: reorderedIds,
          };

          dispatch(
            setDataMaskForFilterChangesComplete(
              customizationFilterChanges,
              oldCustomizationsById as unknown as Filters,
              true,
            ),
          );
        }

        return { result: {}, last_modified_time: Date.now() };
      } catch (errorObject) {
        const { error } = await getClientErrorObject(errorObject);
        addDangerToast(error || t('Failed to save chart customization'));
        throw errorObject;
      }
    },
  });
}
