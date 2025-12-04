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
import { AnyAction } from 'redux';
import { ThunkAction, ThunkDispatch } from 'redux-thunk';
import { t } from '@apache-superset/core';
import {
  makeApi,
  getClientErrorObject,
  ChartCustomization,
  ChartCustomizationDivider,
  ColumnOption,
  Filter,
  Filters,
} from '@superset-ui/core';
import { addDangerToast } from 'src/components/MessageToasts/actions';
import { DashboardInfo, RootState } from 'src/dashboard/types';
import {
  removeDataMask,
  setDataMaskForFilterChangesComplete,
} from 'src/dataMask/actions';
import { dashboardInfoChanged } from './dashboardInfo';
import {
  SET_NATIVE_FILTERS_CONFIG_COMPLETE,
  SET_IN_SCOPE_STATUS_OF_FILTERS,
} from './nativeFilters';
import { SaveFilterChangesType } from '../components/nativeFilters/FiltersConfigModal/types';

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

export const SAVE_CHART_CUSTOMIZATION_COMPLETE =
  'SAVE_CHART_CUSTOMIZATION_COMPLETE';

export function setChartCustomization(
  chartCustomization: ChartCustomization[],
) {
  return { type: SAVE_CHART_CUSTOMIZATION_COMPLETE, chartCustomization };
}

export function saveChartCustomization(
  modifiedCustomizations: (ChartCustomization | ChartCustomizationDivider)[],
  deletedIds: string[],
  reorderedIds: string[] = [],
  resetDataMask: boolean = false,
): ThunkAction<
  Promise<{ result: Partial<DashboardInfo>; last_modified_time: number }>,
  RootState,
  null,
  AnyAction
> {
  return async function (
    dispatch: ThunkDispatch<RootState, null, AnyAction>,
    getState: () => RootState,
  ) {
    const { id, metadata } = getState().dashboardInfo;

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

      dispatch({
        type: SET_NATIVE_FILTERS_CONFIG_COMPLETE,
        filterChanges: response.result,
      });

      const currentMetadata = getState().dashboardInfo.metadata;
      dispatch(
        dashboardInfoChanged({
          metadata: {
            ...currentMetadata,
            chart_customization_config: response.result,
          },
        }),
      );

      if (resetDataMask) {
        const oldConfig = metadata?.chart_customization_config || [];
        const oldCustomizationsById = oldConfig.reduce<
          Record<string, ChartCustomization | ChartCustomizationDivider>
        >((acc, customization) => {
          acc[customization.id] = customization;
          return acc;
        }, {});

        const customizationFilterChanges: SaveFilterChangesType = {
          modified: response.result as unknown as Filter[],
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
      dispatch(
        addDangerToast(error || t('Failed to save chart customization')),
      );
      throw errorObject;
    }
  };
}

export const SET_CHART_CUSTOMIZATION_DATA_LOADING =
  'SET_CHART_CUSTOMIZATION_DATA_LOADING';
export interface SetChartCustomizationDataLoading {
  type: typeof SET_CHART_CUSTOMIZATION_DATA_LOADING;
  itemId: string;
  isLoading: boolean;
}

export function setChartCustomizationDataLoading(
  itemId: string,
  isLoading: boolean,
): SetChartCustomizationDataLoading {
  return {
    type: SET_CHART_CUSTOMIZATION_DATA_LOADING,
    itemId,
    isLoading,
  };
}

export const SET_CHART_CUSTOMIZATION_DATA = 'SET_CHART_CUSTOMIZATION_DATA';
export interface SetChartCustomizationData {
  type: typeof SET_CHART_CUSTOMIZATION_DATA;
  itemId: string;
  data: ColumnOption[];
}

export function setChartCustomizationData(
  itemId: string,
  data: ColumnOption[],
): SetChartCustomizationData {
  return {
    type: SET_CHART_CUSTOMIZATION_DATA,
    itemId,
    data,
  };
}

export function loadChartCustomizationData(
  itemId: string,
  datasetId: string,
  columnName: string | string[],
): ThunkAction<Promise<void>, RootState, null, AnyAction> {
  return async (dispatch: ThunkDispatch<RootState, null, AnyAction>) => {
    if (!datasetId || !columnName) {
      return;
    }

    const actualColumnName = Array.isArray(columnName)
      ? columnName[0]
      : columnName;

    if (!actualColumnName) {
      return;
    }

    dispatch(setChartCustomizationDataLoading(itemId, true));
  };
}

export const SET_PENDING_CHART_CUSTOMIZATION =
  'SET_PENDING_CHART_CUSTOMIZATION';
export interface SetPendingChartCustomization {
  type: typeof SET_PENDING_CHART_CUSTOMIZATION;
  pendingCustomization: ChartCustomization;
}

export function setPendingChartCustomization(
  pendingCustomization: ChartCustomization,
): SetPendingChartCustomization {
  return {
    type: SET_PENDING_CHART_CUSTOMIZATION,
    pendingCustomization,
  };
}

export const CLEAR_PENDING_CHART_CUSTOMIZATION =
  'CLEAR_PENDING_CHART_CUSTOMIZATION';
export interface ClearPendingChartCustomization {
  type: typeof CLEAR_PENDING_CHART_CUSTOMIZATION;
  itemId: string;
}

export function clearPendingChartCustomization(
  itemId: string,
): ClearPendingChartCustomization {
  return {
    type: CLEAR_PENDING_CHART_CUSTOMIZATION,
    itemId,
  };
}

export const CLEAR_ALL_PENDING_CHART_CUSTOMIZATIONS =
  'CLEAR_ALL_PENDING_CHART_CUSTOMIZATIONS';
export interface ClearAllPendingChartCustomizations {
  type: typeof CLEAR_ALL_PENDING_CHART_CUSTOMIZATIONS;
}

export function clearAllPendingChartCustomizations(): ClearAllPendingChartCustomizations {
  return {
    type: CLEAR_ALL_PENDING_CHART_CUSTOMIZATIONS,
  };
}

export const CLEAR_ALL_CHART_CUSTOMIZATIONS = 'CLEAR_ALL_CHART_CUSTOMIZATIONS';
export interface ClearAllChartCustomizations {
  type: typeof CLEAR_ALL_CHART_CUSTOMIZATIONS;
}

export function clearAllChartCustomizations(): ClearAllChartCustomizations {
  return {
    type: CLEAR_ALL_CHART_CUSTOMIZATIONS,
  };
}

export function clearAllChartCustomizationsFromMetadata() {
  return clearAllChartCustomizations();
}

export function setInScopeStatusOfCustomizations(
  customizationScopes: {
    customizationId: string;
    chartsInScope: number[];
    tabsInScope: string[];
  }[],
): ThunkAction<void, RootState, null, AnyAction> {
  return (
    dispatch: ThunkDispatch<RootState, null, AnyAction>,
    getState: () => RootState,
  ) => {
    const { filters } = getState().nativeFilters;

    const scopeConfig = customizationScopes
      .map(({ customizationId, chartsInScope, tabsInScope }) => {
        const existing = filters[customizationId];
        if (!existing) return null;
        return {
          ...existing,
          chartsInScope,
          tabsInScope,
        };
      })
      .filter(Boolean);

    if (scopeConfig.length > 0) {
      dispatch({
        type: SET_IN_SCOPE_STATUS_OF_FILTERS,
        filterConfig: scopeConfig,
      });
    }

    const { metadata } = getState().dashboardInfo;
    const customizationConfig = metadata?.chart_customization_config || [];

    const scopeMap = new Map(
      customizationScopes.map(
        ({ customizationId, chartsInScope, tabsInScope }) => [
          customizationId,
          { chartsInScope, tabsInScope },
        ],
      ),
    );

    const updatedConfig = customizationConfig.map(customization => {
      const scope = scopeMap.get(customization.id);
      if (!scope) {
        return customization;
      }
      return {
        ...customization,
        chartsInScope: scope.chartsInScope,
        tabsInScope: scope.tabsInScope,
      };
    });

    dispatch(
      dashboardInfoChanged({
        metadata: {
          ...metadata,
          chart_customization_config: updatedConfig,
        },
      }),
    );
  };
}

export type AnyChartCustomizationAction =
  | ReturnType<typeof setChartCustomization>
  | SetChartCustomizationDataLoading
  | SetChartCustomizationData
  | SetPendingChartCustomization
  | ClearPendingChartCustomization
  | ClearAllPendingChartCustomizations
  | ClearAllChartCustomizations;
