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

import { create } from 'zustand';
import { devtools, subscribeWithSelector } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { isEqual } from 'lodash';
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
import type { SaveFilterChangesType } from 'src/dashboard/components/nativeFilters/FiltersConfigModal/types';
import {
  migrateChartCustomizationArray,
  isLegacyChartCustomizationFormat,
} from 'src/dashboard/util/migrateChartCustomization';
import { areObjectsEqual } from 'src/reduxUtils';

type FilterWithExtraFormData = Filter & {
  extraFormData?: ExtraFormData;
  filterState?: FilterState;
};

export interface DashboardFilterMetadata {
  chart_configuration?: Record<string, unknown>;
  native_filter_configuration?: FilterConfiguration;
  chart_customization_config?: ChartCustomization[];
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

function fillNativeFilters(
  filterConfig: FilterConfiguration,
  mergedDataMask: DataMaskStateWithId,
  currentDataMask: DataMaskStateWithId,
  initialDataMask?: DataMaskStateWithId,
  currentFilters?: Filters,
  preserveLiveExtras = true,
) {
  filterConfig.forEach(filterEntry => {
    const filter = filterEntry as Filter;
    const dataMask = initialDataMask || {};
    mergedDataMask[filter.id] = {
      ...getInitialDataMask(filter.id),
      ...filter.defaultDataMask,
      ...dataMask[filter.id],
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

  // Get back all other non-native filters (e.g. live cross-filters)
  if (preserveLiveExtras) {
    Object.values(currentDataMask).forEach(filter => {
      if (!String(filter?.id).startsWith(NATIVE_FILTER_PREFIX)) {
        mergedDataMask[filter?.id] = filter;
      }
    });
  }
}

function updateDataMaskForFilterChanges(
  filterChanges: SaveFilterChangesType,
  mergedDataMask: DataMaskStateWithId,
  currentDataMask: DataMaskStateWithId,
  initialDataMask?: Filters,
  isCustomizationChanges?: boolean,
) {
  filterChanges.deleted.forEach((filterId: string) => {
    delete mergedDataMask[filterId];
  });

  filterChanges.modified.forEach(modifiedEntry => {
    const filter = modifiedEntry as Filter;
    const existingFilter = currentDataMask[
      filter.id
    ] as FilterWithExtraFormData;
    const prevFilterDef = initialDataMask?.[filter.id] as Filter | undefined;

    const areTargetsEqual = isEqual(prevFilterDef?.targets, filter?.targets);

    const shouldPreserveState =
      existingFilter &&
      areTargetsEqual &&
      (filter.controlValues?.enableEmptyFilter ||
        filter.controlValues?.defaultToFirstItem);

    mergedDataMask[filter.id] = {
      ...getInitialDataMask(filter.id),
      ...filter.defaultDataMask,
      ...filter,
      ...(shouldPreserveState && {
        extraFormData: existingFilter.extraFormData,
        filterState: existingFilter.filterState,
      }),
    };
  });

  // Preserve state for native filters that were not modified or deleted
  Object.entries(currentDataMask).forEach(([key, value]) => {
    if (String(value?.id).startsWith(NATIVE_FILTER_PREFIX)) {
      const wasDeleted = filterChanges.deleted.includes(key);
      const wasModified = filterChanges.modified.some(f => f.id === key);
      if (!wasDeleted && !wasModified) {
        mergedDataMask[key] = value;
      }
    }
  });

  Object.values(currentDataMask).forEach(filter => {
    const filterId = String(filter?.id);
    const shouldSkip = isCustomizationChanges
      ? isChartCustomization(filterId)
      : filterId.startsWith(NATIVE_FILTER_PREFIX);
    if (!shouldSkip) {
      mergedDataMask[filter?.id] = filter;
    }
  });
}

/** Builds the hydrated dataMask map; extracted so hydration can reuse it. */
export function buildHydratedDataMask(
  metadata: DashboardFilterMetadata | undefined,
  currentDataMask: DataMaskStateWithId,
  loadedDataMask?: DataMaskStateWithId,
  // When false, drop live cross-filter selections instead of carrying them over
  // (in-place discard uses this to match the pre-migration page-reload behavior).
  preserveLiveExtras = true,
): DataMaskStateWithId {
  const cleanState: DataMaskStateWithId = {};

  Object.keys(metadata?.chart_configuration || {}).forEach(id => {
    cleanState[id] = { ...(getInitialDataMask(id) as DataMaskWithId) };
  });

  fillNativeFilters(
    metadata?.native_filter_configuration ?? [],
    cleanState,
    currentDataMask,
    loadedDataMask,
    undefined,
    preserveLiveExtras,
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
      currentDataMask[customizationFilterId] &&
      item.defaultDataMask &&
      !areObjectsEqual(
        item.defaultDataMask,
        currentDataMask[customizationFilterId],
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

  if (preserveLiveExtras) {
    Object.values(currentDataMask).forEach(filter => {
      if (
        filter?.id &&
        !isChartCustomization(String(filter.id)) &&
        !cleanState[filter.id]
      ) {
        cleanState[filter.id] = filter;
      }
    });
  }

  return cleanState;
}

export interface DataMaskStore {
  dataMask: DataMaskStateWithId;
  updateDataMask: (filterId: string | number, dataMask: DataMask) => void;
  removeDataMask: (filterId: string | number) => void;
  clearDataMask: () => void;
  setDataMaskForFilterChanges: (
    filterChanges: SaveFilterChangesType,
    filters?: Filters,
    isCustomizationChanges?: boolean,
  ) => void;
  /** Replaces dataMask from the dashboard hydration payload. */
  hydrateDataMask: (
    metadata: DashboardFilterMetadata | undefined,
    loadedDataMask?: DataMaskStateWithId,
    preserveLiveExtras?: boolean,
  ) => void;
  /** Merges the Explore hydration payload into dataMask. */
  hydrateExploreDataMask: (loadedDataMask?: DataMaskStateWithId) => void;
}

export const useDataMaskStore = create<DataMaskStore>()(
  devtools(
    subscribeWithSelector(
      immer<DataMaskStore>((set, get) => ({
        dataMask: {},

        updateDataMask: (filterId, dataMask) =>
          set(state => {
            state.dataMask[filterId] = {
              ...getInitialDataMask(filterId),
              ...state.dataMask[filterId],
              ...dataMask,
            };
          }),

        removeDataMask: filterId =>
          set(state => {
            delete state.dataMask[filterId];
          }),

        clearDataMask: () =>
          set(state => {
            state.dataMask = {};
          }),

        setDataMaskForFilterChanges: (
          filterChanges,
          filters,
          isCustomizationChanges,
        ) => {
          const cleanState: DataMaskStateWithId = {};
          updateDataMaskForFilterChanges(
            filterChanges,
            cleanState,
            get().dataMask,
            filters,
            isCustomizationChanges,
          );
          set(state => {
            state.dataMask = cleanState;
          });
        },

        hydrateDataMask: (
          metadata,
          loadedDataMask,
          preserveLiveExtras = true,
        ) => {
          const cleanState = buildHydratedDataMask(
            metadata,
            get().dataMask,
            loadedDataMask,
            preserveLiveExtras,
          );
          set(state => {
            state.dataMask = cleanState;
          });
        },

        hydrateExploreDataMask: loadedDataMask =>
          set(state => {
            if (loadedDataMask) {
              Object.entries(loadedDataMask).forEach(([id, mask]) => {
                state.dataMask[id] = {
                  ...getInitialDataMask(id),
                  ...state.dataMask[id],
                  ...mask,
                };
              });
            }
          }),
      })),
    ),
    {
      name: 'DataMaskStore',
      enabled: process.env.WEBPACK_MODE === 'development',
    },
  ),
);
