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

/* eslint-disable no-param-reassign */
// <- When we work with Immer, we need reassign, so disabling lint
import { produce } from 'immer';
import {
  DataMask,
  DataMaskStateWithId,
  DataMaskWithId,
  Filter,
  FilterConfiguration,
  Filters,
  FilterState,
  ExtraFormData,
  ChartCustomization,
} from '@superset-ui/core';
import {
  NATIVE_FILTER_PREFIX,
  isChartCustomization,
} from 'src/dashboard/components/nativeFilters/FiltersConfigModal/utils';
import { HYDRATE_DASHBOARD } from 'src/dashboard/actions/hydrate';
import {
  HYDRATE_EXPLORE,
  HydrateExplore,
} from 'src/explore/actions/hydrateExplore';
import { SaveFilterChangesType } from 'src/dashboard/components/nativeFilters/FiltersConfigModal/types';
import {
  migrateChartCustomizationArray,
  isLegacyChartCustomizationFormat,
} from 'src/dashboard/util/migrateChartCustomization';
import { isEqual } from 'lodash-es';
import {
  AnyDataMaskAction,
  CLEAR_DATA_MASK_STATE,
  REMOVE_DATA_MASK,
  SET_DATA_MASK_FOR_FILTER_CHANGES_COMPLETE,
  UPDATE_DATA_MASK,
} from './actions';
import { areObjectsEqual } from '../reduxUtils';

type FilterWithExtaFromData = Filter & {
  extraFormData?: ExtraFormData;
  filterState?: FilterState;
};

interface DashboardMetadata {
  chart_configuration?: Record<string, unknown>;
  native_filter_configuration?: FilterConfiguration;
  chart_customization_config?: ChartCustomization[];
}

export interface HydrateDataMaskAction {
  type: typeof HYDRATE_DASHBOARD;
  data: {
    dashboardInfo: {
      metadata: DashboardMetadata;
    };
    dataMask?: DataMaskStateWithId;
  };
}

function isChartCustomizationItem(item: unknown): item is ChartCustomization {
  return (
    typeof item === 'object' &&
    item !== null &&
    'id' in item &&
    typeof item.id === 'string' &&
    'type' in item &&
    'defaultDataMask' in item
  );
}

export function getInitialDataMask(
  id?: string | number,
  moreProps: DataMask = {},
): DataMask | DataMaskWithId {
  return {
    ...(id !== undefined ? { id } : {}),
    extraFormData: {},
    filterState: {},
    ownState: {},
    ...moreProps,
  } as DataMask | DataMaskWithId;
}

function fillNativeFilters(
  filterConfig: FilterConfiguration,
  mergedDataMask: DataMaskStateWithId,
  draftDataMask: DataMaskStateWithId,
  initialDataMask?: DataMaskStateWithId,
  currentFilters?: Filters,
) {
  filterConfig.forEach((filter: Filter) => {
    const dataMask = initialDataMask || {};
    const loaded = dataMask[filter.id];

    // The shallow spread of `loaded` would override `filter.defaultDataMask`
    // even when the loaded mask is incomplete (e.g. a permalink captured
    // mid-initialization), wiping out a valid default. For REQUIRED filters
    // with a default, fall back to the default when the loaded mask carries
    // no real value OR is missing the extraFormData needed to filter charts.
    // Non-required filters keep current behavior so a user's explicit clear
    // isn't undone.
    const isRequired = !!filter.controlValues?.enableEmptyFilter;
    const loadedValue = loaded?.filterState?.value;
    const loadedHasValue =
      loadedValue !== undefined &&
      loadedValue !== null &&
      !(
        // Treat all-null arrays (range filters use [null, null] as their
        // canonical cleared value) and empty arrays as "no value".
        Array.isArray(loadedValue) && loadedValue.every(v => v === null)
      );
    const loadedHasExtraFormData =
      !!loaded?.extraFormData && Object.keys(loaded.extraFormData).length > 0;
    const defaultHasExtraFormData =
      !!filter.defaultDataMask?.extraFormData &&
      Object.keys(filter.defaultDataMask.extraFormData).length > 0;
    // Restore when:
    //  (1) loaded value is empty — classic "default wiped by stale permalink", OR
    //  (2) loaded has a value but no extraFormData and the default does — the
    //      "value present in UI but not applied to charts" gap-window case where
    //      a permalink was captured before FilterValue produced extraFormData.
    const shouldRestoreDefault =
      isRequired &&
      !!filter.defaultDataMask &&
      (!loadedHasValue || (!loadedHasExtraFormData && defaultHasExtraFormData));

    mergedDataMask[filter.id] = {
      ...getInitialDataMask(filter.id), // take initial data
      ...filter.defaultDataMask, // if something new came from BE - take it
      ...loaded,
      ...(shouldRestoreDefault
        ? {
            filterState: filter.defaultDataMask?.filterState,
            extraFormData: filter.defaultDataMask?.extraFormData,
          }
        : {}),
    };
    if (
      currentFilters &&
      !areObjectsEqual(
        filter.defaultDataMask,
        currentFilters[filter.id]?.defaultDataMask,
        { ignoreUndefined: true },
      )
    ) {
      mergedDataMask[filter.id] = {
        ...mergedDataMask[filter.id],
        ...filter.defaultDataMask,
      };
    }
  });

  // Get back all other non-native filters
  Object.values(draftDataMask).forEach(filter => {
    if (!String(filter?.id).startsWith(NATIVE_FILTER_PREFIX)) {
      mergedDataMask[filter?.id] = filter;
    }
  });
}

function updateDataMaskForFilterChanges(
  filterChanges: SaveFilterChangesType,
  mergedDataMask: DataMaskStateWithId,
  draftDataMask: DataMaskStateWithId,
  initialDataMask?: Filters,
  isCustomizationChanges?: boolean,
) {
  filterChanges.deleted.forEach((filterId: string) => {
    delete mergedDataMask[filterId];
  });

  filterChanges.modified.forEach((filter: Filter) => {
    const existingFilter = draftDataMask[filter.id] as FilterWithExtaFromData;
    const prevFilterDef = initialDataMask?.[filter.id] as Filter | undefined;

    // Check if targets are equal
    const areTargetsEqual = isEqual(prevFilterDef?.targets, filter?.targets);

    // For required filters, only preserve existing state when it actually has
    // a value — otherwise the empty existing state would wipe the (possibly
    // newly-defined) default. defaultToFirstItem filters keep the old behavior:
    // FilterValue re-resolves the first item at runtime, so preserving the
    // mid-init empty state is fine.
    const isRequired = !!filter.controlValues?.enableEmptyFilter;
    const isFirstItem = !!filter.controlValues?.defaultToFirstItem;
    const existingValue = existingFilter?.filterState?.value;
    const hasExistingValue =
      existingValue !== undefined &&
      existingValue !== null &&
      // Treat all-null arrays (range filters use [null, null] as their
      // canonical cleared value) and empty arrays as "no value", consistent
      // with `loadedHasValue` in fillNativeFilters above. `[].every()` is
      // true, so this also covers the empty-array case.
      !(Array.isArray(existingValue) && existingValue.every(v => v === null));

    const shouldPreserveState =
      existingFilter &&
      areTargetsEqual &&
      (isRequired || isFirstItem) &&
      (isFirstItem || hasExistingValue);

    mergedDataMask[filter.id] = {
      ...getInitialDataMask(filter.id),
      ...filter.defaultDataMask,
      ...filter,
      // Preserve extraFormData and filterState if conditions match
      ...(shouldPreserveState && {
        extraFormData: existingFilter.extraFormData,
        filterState: existingFilter.filterState,
      }),
    };
  });

  // Preserve state for native filters that were not modified or deleted
  Object.entries(draftDataMask).forEach(([key, value]) => {
    if (String(value?.id).startsWith(NATIVE_FILTER_PREFIX)) {
      const wasDeleted = filterChanges.deleted.includes(key);
      const wasModified = filterChanges.modified.some(f => f.id === key);
      if (!wasDeleted && !wasModified) {
        mergedDataMask[key] = value;
      }
    }
  });

  Object.values(draftDataMask).forEach(filter => {
    const filterId = String(filter?.id);
    const shouldSkip = isCustomizationChanges
      ? isChartCustomization(filterId)
      : filterId.startsWith(NATIVE_FILTER_PREFIX);
    if (!shouldSkip) {
      mergedDataMask[filter?.id] = filter;
    }
  });
}

const dataMaskReducer = produce(
  (
    draft: DataMaskStateWithId,
    action: AnyDataMaskAction | HydrateDataMaskAction | HydrateExplore,
  ) => {
    const cleanState: DataMaskStateWithId = {};
    switch (action.type) {
      case CLEAR_DATA_MASK_STATE:
        return cleanState;
      case UPDATE_DATA_MASK:
        draft[action.filterId] = {
          ...getInitialDataMask(action.filterId),
          ...draft[action.filterId],
          ...action.dataMask,
        };
        return draft;
      case HYDRATE_DASHBOARD: {
        const hydrateDashboardAction = action as HydrateDataMaskAction;
        const metadata = hydrateDashboardAction.data.dashboardInfo?.metadata;
        const loadedDataMask = hydrateDashboardAction.data.dataMask;

        Object.keys(metadata?.chart_configuration || {}).forEach(id => {
          cleanState[id] = {
            ...(getInitialDataMask(id) as DataMaskWithId),
          };
        });

        fillNativeFilters(
          metadata?.native_filter_configuration ?? [],
          cleanState,
          draft,
          loadedDataMask,
        );

        const rawChartCustomizationConfig = (
          metadata?.chart_customization_config || []
        ).filter(Boolean);

        const hasLegacyFormat = rawChartCustomizationConfig.some(item =>
          isLegacyChartCustomizationFormat(item),
        );

        const chartCustomizationConfig = hasLegacyFormat
          ? migrateChartCustomizationArray(rawChartCustomizationConfig)
          : (rawChartCustomizationConfig as ChartCustomization[]);

        chartCustomizationConfig.forEach(item => {
          if (!isChartCustomizationItem(item)) {
            return;
          }

          const customizationFilterId = item.id;
          const dataMask = loadedDataMask || {};

          cleanState[customizationFilterId] = {
            ...getInitialDataMask(customizationFilterId),
            ...item.defaultDataMask,
            ...dataMask[customizationFilterId],
          };

          if (
            draft[customizationFilterId] &&
            item.defaultDataMask &&
            !areObjectsEqual(
              item.defaultDataMask,
              draft[customizationFilterId],
              { ignoreUndefined: true },
            )
          ) {
            cleanState[customizationFilterId] = {
              ...cleanState[customizationFilterId],
              ...item.defaultDataMask,
            };
          }

          if (item.controlValues?.column) {
            cleanState[customizationFilterId].ownState = {
              ...cleanState[customizationFilterId].ownState,
              column: item.controlValues.column,
            };
          }
        });

        Object.values(draft).forEach(filter => {
          if (
            filter?.id &&
            !isChartCustomization(String(filter.id)) &&
            !cleanState[filter.id]
          ) {
            cleanState[filter.id] = filter;
          }
        });

        return cleanState;
      }
      case HYDRATE_EXPLORE: {
        const hydrateExploreAction = action as HydrateExplore;
        const loadedDataMask = hydrateExploreAction.data.dataMask;
        if (loadedDataMask) {
          Object.entries(loadedDataMask).forEach(([id, mask]) => {
            draft[id] = {
              ...getInitialDataMask(id),
              ...draft[id],
              ...mask,
            };
          });
        }
        return draft;
      }
      case SET_DATA_MASK_FOR_FILTER_CHANGES_COMPLETE:
        updateDataMaskForFilterChanges(
          action.filterChanges,
          cleanState,
          draft,
          action.filters,
          action.isCustomizationChanges,
        );
        return cleanState;
      case REMOVE_DATA_MASK:
        delete draft[action.filterId];
        return draft;
      default:
        return draft;
    }
  },
  {},
);

export default dataMaskReducer;
