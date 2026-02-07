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
import {
  FC,
  memo,
  useEffect,
  useState,
  useCallback,
  useRef,
  useMemo,
} from 'react';

import { useDispatch, useSelector, batch } from 'react-redux';
import {
  DataMaskStateWithId,
  DataMaskWithId,
  Filter,
  Divider,
  DataMask,
  isNativeFilter,
  usePrevious,
  NativeFilterTarget,
  ChartCustomization,
  ChartCustomizationDivider,
  FeatureFlag,
  isFeatureEnabled,
} from '@superset-ui/core';
import { styled } from '@apache-superset/core/ui';
import { Constants } from '@superset-ui/core/components';
import { useHistory } from 'react-router-dom';
import { updateDataMask, removeDataMask } from 'src/dataMask/actions';
import {
  saveChartCustomization,
  clearAllPendingChartCustomizations,
  clearAllChartCustomizationsFromMetadata,
} from 'src/dashboard/actions/chartCustomizationActions';

import { useImmer } from 'use-immer';
import { isEmpty, isEqual, debounce } from 'lodash';
import { areObjectsEqual } from 'src/reduxUtils';
import { getInitialDataMask } from 'src/dataMask/reducer';
import { URL_PARAMS } from 'src/constants';
import getBootstrapData, { applicationRoot } from 'src/utils/getBootstrapData';
import { getUrlParam } from 'src/utils/urlUtils';
import { useTabId } from 'src/hooks/useTabId';
import { logEvent } from 'src/logger/actions';
import { LOG_ACTIONS_CHANGE_DASHBOARD_FILTER } from 'src/logger/LogUtils';
import { FilterBarOrientation, RootState } from 'src/dashboard/types';
import { UserWithPermissionsAndRoles } from 'src/types/bootstrapTypes';
import { isChartCustomization } from '../FiltersConfigModal/utils';
import { checkIsApplyDisabled } from './utils';
import { extractLabel } from '../selectors';
import { FiltersBarProps } from './types';
import {
  useAllAppliedDataMask,
  useFilters,
  useFilterUpdates,
  useInitialization,
} from './state';
import { createFilterKey, updateFilterKey } from './keyValue';
import ActionButtons from './ActionButtons';
import Horizontal from './Horizontal';
import Vertical from './Vertical';
import {
  useSelectFiltersInScope,
  useChartCustomizationConfiguration,
} from '../state';

// FilterBar is just being hidden as it must still
// render fully due to encapsulated logics
const HiddenFilterBar = styled.div`
  display: none;
`;

const EXCLUDED_URL_PARAMS: string[] = [
  URL_PARAMS.nativeFilters.name,
  URL_PARAMS.permalinkKey.name,
];

const EMPTY_DATA_MASK_RECORD: Record<string, DataMask> = {};

const publishDataMask = debounce(
  async (
    history,
    dashboardId,
    updateKey,
    dataMaskSelected: DataMaskStateWithId,
    tabId,
  ) => {
    const { location } = history;
    const { search } = location;
    const previousParams = new URLSearchParams(search);
    const newParams = new URLSearchParams();
    let dataMaskKey: string | null;
    previousParams.forEach((value, key) => {
      if (!EXCLUDED_URL_PARAMS.includes(key)) {
        newParams.append(key, value);
      }
    });

    const nativeFiltersCacheKey = getUrlParam(URL_PARAMS.nativeFiltersKey);
    const dataMask = JSON.stringify(dataMaskSelected);

    if (
      updateKey &&
      nativeFiltersCacheKey &&
      (await updateFilterKey(
        dashboardId,
        dataMask,
        nativeFiltersCacheKey,
        tabId,
      ))
    ) {
      dataMaskKey = nativeFiltersCacheKey;
    } else {
      dataMaskKey = await createFilterKey(dashboardId, dataMask, tabId);
    }
    if (dataMaskKey) {
      newParams.set(URL_PARAMS.nativeFiltersKey.name, dataMaskKey);
    }

    // pathname could be updated somewhere else through window.history
    // keep react router history in sync with window history
    // replace params only when current page is /superset/dashboard
    // this prevents a race condition between updating filters and navigating to Explore
    if (window.location.pathname.includes('/superset/dashboard')) {
      // The history API is part of React router and understands that a basename may exist.
      // Internally it treats all paths as if they are relative to the root and appends
      // it when necessary. We strip any prefix so that history.replace adds it back and doesn't
      // double it up.
      const appRoot = applicationRoot();
      let replacement_pathname = window.location.pathname;
      if (appRoot !== '/' && replacement_pathname.startsWith(appRoot)) {
        replacement_pathname = replacement_pathname.substring(appRoot.length);
      }
      history.location.pathname = replacement_pathname;
      history.replace({
        search: newParams.toString(),
      });
    }
  },
  Constants.SLOW_DEBOUNCE,
);

const FilterBar: FC<FiltersBarProps> = ({
  orientation = FilterBarOrientation.Vertical,
  verticalConfig,
  hidden = false,
}) => {
  const history = useHistory();
  const dataMaskApplied: DataMaskStateWithId = useAllAppliedDataMask();

  const [dataMaskSelected, setDataMaskSelected] =
    useImmer<DataMaskStateWithId>(dataMaskApplied);
  const [pendingCustomizationDataMasks, setPendingCustomizationDataMasks] =
    useState<Record<string, DataMask>>(EMPTY_DATA_MASK_RECORD);
  const chartCustomizationValues = useChartCustomizationConfiguration();
  const dispatch = useDispatch();
  const [updateKey, setUpdateKey] = useState(0);
  const tabId = useTabId();
  const filters = useFilters();
  const previousFilters = usePrevious(filters);
  const filterValues = useMemo(
    () => Object.values(filters) as (Filter | Divider)[],
    [filters],
  );
  const nativeFilterValues = useMemo(
    () => filterValues.filter(isNativeFilter),
    [filterValues],
  );
  const dashboardId = useSelector<any, number>(
    ({ dashboardInfo }) => dashboardInfo?.id,
  );
  const previousDashboardId = usePrevious(dashboardId);
  const canEdit = useSelector<RootState, boolean>(
    ({ dashboardInfo }) => dashboardInfo.dash_edit_perm,
  );
  const user: UserWithPermissionsAndRoles = useSelector<
    RootState,
    UserWithPermissionsAndRoles
  >(state => state.user);

  const [filtersInScope] = useSelectFiltersInScope(nativeFilterValues);
  const [clearAllTriggers, setClearAllTriggers] = useState<
    Record<string, boolean>
  >({});
  const [initializedFilters, setInitializedFilters] = useState<Set<string>>(
    new Set(),
  );
  const [hasClearedChartCustomizations, setHasClearedChartCustomizations] =
    useState(false);

  // Progress indicator state (visible for at least MIN_VISIBLE_MS)
  const MIN_VISIBLE_MS = 400;
  // Auto-apply debounce interval, configurable via backend conf
  const configuredDebounce =
    getBootstrapData()?.common?.conf?.AUTO_APPLY_DASHBOARD_FILTERS_DEBOUNCE_MS;
  const AUTO_APPLY_DEBOUNCE_MS =
    (typeof configuredDebounce === 'number' && configuredDebounce > 0
      ? configuredDebounce
      : 700);
  const [isApplying, setIsApplying] = useState(false);
  const applyStartTsRef = useRef<number | null>(null);

  // keep local selection state; avoid unused refs
  const handleFilterSelectionChange = useCallback(
    (
      filter: Pick<Filter, 'id'> & Partial<Filter>,
      dataMask: Partial<DataMask>,
    ) => {
      setDataMaskSelected(draft => {
        const appliedDataMask = dataMaskApplied[filter.id];
        const isFirstTimeInitialization = !initializedFilters.has(filter.id);

        // Auto-apply when filter has value but empty extraFormData in applied state
        // This fixes the bug where defaultDataMask.filterState.value exists but extraFormData is empty
        // Only auto-apply if: value matches what's applied AND extraFormData is missing in applied but present in incoming
        const needsAutoApply =
          appliedDataMask?.filterState?.value !== undefined &&
          dataMask.filterState?.value !== undefined &&
          isEqual(
            appliedDataMask.filterState.value,
            dataMask.filterState.value,
          ) &&
          (!appliedDataMask?.extraFormData ||
            Object.keys(appliedDataMask.extraFormData || {}).length === 0) &&
          dataMask.extraFormData &&
          Object.keys(dataMask.extraFormData).length > 0;

        // Force instant updating for requiredFirst filters or auto-apply when needed
        const shouldDispatch =
          dataMask.filterState?.value !== undefined &&
          ((isFirstTimeInitialization && filter.requiredFirst) ||
            needsAutoApply);

        if (shouldDispatch) {
          dispatch(updateDataMask(filter.id, dataMask));
        }

        // Mark filter as initialized after getting its first value WITH extraFormData
        // This ensures we don't mark it as initialized on the first sync (value but no extraFormData)
        // but do mark it after the second sync (value AND extraFormData)
        if (
          dataMask.filterState?.value !== undefined &&
          dataMask.extraFormData &&
          Object.keys(dataMask.extraFormData).length > 0 &&
          !initializedFilters.has(filter.id)
        ) {
          setInitializedFilters(prev => new Set(prev).add(filter.id));
        }

        const baseDataMask = {
          ...(getInitialDataMask(filter.id) as DataMaskWithId),
          ...dataMask,
        };

        // Recalculate validation status
        const isRequired = !!filter.controlValues?.enableEmptyFilter;
        const value = baseDataMask.filterState?.value;

        const isEmptyValue =
          value == null ||
          (Array.isArray(value) && value.length === 0) ||
          (typeof value === 'string' && value.trim() === '');

        const hasRequiredValue = isRequired && isEmptyValue;

        draft[filter.id] = {
          ...baseDataMask,
          filterState: {
            ...baseDataMask.filterState,
            validateStatus: hasRequiredValue ? 'error' : undefined,
          },
        };
      });
    },
    [
      dispatch,
      setDataMaskSelected,
      initializedFilters,
      setInitializedFilters,
      dataMaskApplied,
    ],
  );

  useEffect(() => {
    if (previousFilters && dashboardId === previousDashboardId) {
      const updates: Record<string, DataMaskWithId> = {};
      Object.values(filters).forEach(currentFilter => {
        const previousFilter = previousFilters?.[currentFilter.id];
        if (!previousFilter) {
          return;
        }
        const currentType = currentFilter.filterType;
        const currentTargets = currentFilter.targets;
        const currentDataMask = currentFilter.defaultDataMask;
        const previousType = previousFilter?.filterType;
        const previousTargets = previousFilter?.targets;
        const previousDataMask = previousFilter?.defaultDataMask;
        const typeChanged = currentType !== previousType;
        const targetsChanged = !isEqual(currentTargets, previousTargets);
        const dataMaskChanged = !isEqual(currentDataMask, previousDataMask);

        if (typeChanged || targetsChanged || dataMaskChanged) {
          updates[currentFilter.id] = getInitialDataMask(
            currentFilter.id,
          ) as DataMaskWithId;
        }
      });

      if (!isEmpty(updates)) {
        setDataMaskSelected(draft => ({ ...draft, ...updates }));
      }
    }
  }, [dashboardId, filters, previousDashboardId, setDataMaskSelected]);

  const dataMaskAppliedText = useMemo(
    () => JSON.stringify(dataMaskApplied),
    [dataMaskApplied],
  );

  useEffect(() => {
    setDataMaskSelected(() => dataMaskApplied);
  }, [dataMaskAppliedText, setDataMaskSelected, dashboardId]);

  useEffect(() => {
    // embedded users can't persist filter combinations
    if (user?.userId) {
      publishDataMask(history, dashboardId, updateKey, dataMaskApplied, tabId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dashboardId, dataMaskAppliedText, history, updateKey, tabId]);

  const pendingChartCustomizations = useSelector<
    RootState,
    Record<string, ChartCustomization> | undefined
  >(state => state.dashboardInfo.pendingChartCustomizations);

  const handlePendingCustomizationDataMaskChange = useCallback(
    (customizationId: string, dataMask: DataMask) => {
      setPendingCustomizationDataMasks(prev => ({
        ...prev,
        [customizationId]: dataMask,
      }));
    },
    [],
  );

  const handleApply = useCallback(() => {
    // start progress overlay if feature flag is enabled
    if (isFeatureEnabled(FeatureFlag.FilterBarProgressIndicator)) {
      if (!isApplying) {
        setIsApplying(true);
        applyStartTsRef.current = Date.now();
      } else {
        // already applying; extend timing window
        applyStartTsRef.current = applyStartTsRef.current || Date.now();
      }
    }
    // Batch updates to minimize re-renders and expensive downstream work
    batch(() => {
      dispatch(logEvent(LOG_ACTIONS_CHANGE_DASHBOARD_FILTER, {}));
      setUpdateKey(1);

      Object.entries(dataMaskSelected).forEach(([filterId, selectedMask]) => {
        if (!selectedMask) return;
        const appliedMask = dataMaskApplied[filterId];
        const changed = !areObjectsEqual(
          {
            filterState: selectedMask.filterState,
            ownState: selectedMask.ownState,
            extraFormData: selectedMask.extraFormData,
          },
          appliedMask
            ? {
                filterState: appliedMask.filterState,
                ownState: appliedMask.ownState,
                extraFormData: appliedMask.extraFormData,
              }
            : undefined,
          { ignoreUndefined: true },
        );
        if (changed) {
          dispatch(updateDataMask(filterId, selectedMask));
        }
      });
    });

    if (
      pendingCustomizationDataMasks &&
      Object.keys(pendingCustomizationDataMasks).length > 0
    ) {
      Object.entries(pendingCustomizationDataMasks).forEach(
        ([customizationId, dataMask]) => {
          const customizationFilterId = customizationId;
          if (dataMask) {
            dispatch(updateDataMask(customizationFilterId, dataMask));
          }
        },
      );
    }

    if (
      pendingChartCustomizations &&
      Object.keys(pendingChartCustomizations).length > 0
    ) {
      const pendingItems = Object.values(pendingChartCustomizations).filter(
        Boolean,
      ) as (ChartCustomization | ChartCustomizationDivider)[];

      if (pendingItems.length > 0) {
        dispatch(saveChartCustomization(pendingItems, []));
      }
      dispatch(clearAllPendingChartCustomizations());
      setPendingCustomizationDataMasks({});
    } else if (hasClearedChartCustomizations) {
      const clearedChartCustomizations = chartCustomizationValues.map(item => ({
        ...item,
        targets: [
          {
            datasetId: item.targets?.[0]?.datasetId,
          },
        ] as [Partial<NativeFilterTarget>],
      }));

      chartCustomizationValues.forEach(item => {
        dispatch(removeDataMask(item.id));
      });

      dispatch(clearAllChartCustomizationsFromMetadata());

      dispatch(saveChartCustomization(clearedChartCustomizations, []));
    }

    setHasClearedChartCustomizations(false);

    // ensure progress overlay stays for a minimum visible duration
    if (isFeatureEnabled(FeatureFlag.FilterBarProgressIndicator)) {
      const start = applyStartTsRef.current || Date.now();
      const elapsed = Date.now() - start;
      const remaining = Math.max(MIN_VISIBLE_MS - elapsed, 0);
      window.setTimeout(() => {
        setIsApplying(false);
        applyStartTsRef.current = null;
      }, remaining);
    }
  }, [
    dataMaskSelected,
    dispatch,
    pendingChartCustomizations,
    pendingCustomizationDataMasks,
    hasClearedChartCustomizations,
    chartCustomizationValues,
    isApplying,
  ]);

  const handleClearAll = useCallback(() => {
    const newClearAllTriggers = { ...clearAllTriggers };
    nativeFilterValues.forEach(filter => {
      const { id } = filter;
      if (dataMaskSelected[id]) {
        setDataMaskSelected(draft => {
          if (draft[id].filterState?.value !== undefined) {
            draft[id].filterState!.value = undefined;
          }
          draft[id].extraFormData = {};
        });
        newClearAllTriggers[id] = true;
      }
    });

    const allDataMasks = { ...dataMaskSelected, ...dataMaskApplied };
    const hasCustomizationDataMasks = Object.keys(allDataMasks).some(key =>
      isChartCustomization(key),
    );
    const hasSavedCustomizations = chartCustomizationValues.some(item => {
      if (item.removed) return false;
      const mask = dataMaskApplied[item.id] || dataMaskSelected[item.id];
      return extractLabel(mask?.filterState) !== null;
    });

    if (hasCustomizationDataMasks || hasSavedCustomizations) {
      chartCustomizationValues.forEach(item => {
        setDataMaskSelected(draft => {
          draft[item.id] = {
            id: item.id,
            filterState: { value: null },
            ownState: { column: null },
            extraFormData: {},
          };
        });
      });

      dispatch(clearAllPendingChartCustomizations());
      setPendingCustomizationDataMasks({});
      setHasClearedChartCustomizations(true);
    }

    setClearAllTriggers(newClearAllTriggers);
  }, [
    dataMaskSelected,
    dataMaskApplied,
    nativeFilterValues,
    setDataMaskSelected,
    chartCustomizationValues,
    clearAllTriggers,
    dispatch,
  ]);

  const handleClearAllComplete = useCallback((filterId: string) => {
    setClearAllTriggers(prev => {
      const newTriggers = { ...prev };
      delete newTriggers[filterId];
      return newTriggers;
    });
  }, []);

  useFilterUpdates(dataMaskSelected, setDataMaskSelected);

  const hasPendingChartCustomizations =
    pendingChartCustomizations &&
    Object.keys(pendingChartCustomizations).length > 0;

  const hasMissingRequiredChartCustomization =
    chartCustomizationValues?.some(item => {
      if (item.removed) return false;

      const required = !!item.controlValues?.enableEmptyFilter;
      if (!required) return false;

      const mask =
        pendingCustomizationDataMasks?.[item.id] || dataMaskSelected[item.id];
      const hasValue = extractLabel(mask?.filterState) !== null;

      return !hasValue;
    }) || false;

  const isApplyDisabled = useMemo(() => {
    const checkResult = checkIsApplyDisabled(
      dataMaskSelected,
      dataMaskApplied,
      filtersInScope.filter(isNativeFilter),
    );

    return (
      (checkResult &&
        !hasPendingChartCustomizations &&
        !hasClearedChartCustomizations) ||
      hasMissingRequiredChartCustomization
    );
  }, [
    dataMaskSelected,
    dataMaskApplied,
    filtersInScope,
    hasPendingChartCustomizations,
    hasClearedChartCustomizations,
    hasMissingRequiredChartCustomization,
  ]);

  const isInitialized = useInitialization();

  // Auto-apply support: debounced apply when changes exist
  const autoApplyEnabled = isFeatureEnabled(
    FeatureFlag.AutoApplyDashboardFilters,
  );
  const autoApplyFnRef = useRef<ReturnType<typeof debounce>>();
  const stableApplyRef = useRef(handleApply);
  stableApplyRef.current = handleApply;
  useEffect(() => {
    if (!autoApplyFnRef.current) {
      autoApplyFnRef.current = debounce(() => {
        stableApplyRef.current();
      }, AUTO_APPLY_DEBOUNCE_MS);
    }
    return () => {
      autoApplyFnRef.current?.cancel();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (!autoApplyEnabled) {
      autoApplyFnRef.current?.cancel();
      return;
    }
    if (!isApplyDisabled) {
      autoApplyFnRef.current?.();
    } else {
      autoApplyFnRef.current?.cancel();
    }
  }, [autoApplyEnabled, isApplyDisabled, dataMaskSelected]);

  const actions = useMemo(
    () => (
      <ActionButtons
        filterBarOrientation={orientation}
        width={verticalConfig?.width}
        onApply={handleApply}
        onClearAll={handleClearAll}
        dataMaskSelected={dataMaskSelected}
        dataMaskApplied={dataMaskApplied}
        isApplyDisabled={isApplyDisabled}
        hideApplyButton={autoApplyEnabled}
        showProgressOverlay={
          isFeatureEnabled(FeatureFlag.FilterBarProgressIndicator) && isApplying
        }
        chartCustomizationItems={chartCustomizationValues}
      />
    ),
    [
      orientation,
      verticalConfig?.width,
      handleApply,
      handleClearAll,
      dataMaskSelected,
      dataMaskApplied,
      isApplyDisabled,
      autoApplyEnabled,
      isApplying,
      chartCustomizationValues,
    ],
  );

  const filterBarComponent =
    orientation === FilterBarOrientation.Horizontal ? (
      <Horizontal
        actions={actions}
        canEdit={canEdit}
        dashboardId={dashboardId}
        dataMaskSelected={dataMaskSelected}
        filterValues={filterValues}
        chartCustomizationValues={chartCustomizationValues}
        isInitialized={isInitialized}
        showProgressOverlay={
          isFeatureEnabled(FeatureFlag.FilterBarProgressIndicator) && isApplying
        }
        onSelectionChange={handleFilterSelectionChange}
        onPendingCustomizationDataMaskChange={
          handlePendingCustomizationDataMaskChange
        }
        clearAllTriggers={clearAllTriggers}
        onClearAllComplete={handleClearAllComplete}
      />
    ) : verticalConfig ? (
      <Vertical
        actions={actions}
        canEdit={canEdit}
        dataMaskSelected={dataMaskSelected}
        filtersOpen={verticalConfig.filtersOpen}
        filterValues={filterValues}
        chartCustomizationValues={chartCustomizationValues}
        isInitialized={isInitialized}
        height={verticalConfig.height}
        offset={verticalConfig.offset}
        onSelectionChange={handleFilterSelectionChange}
        onPendingCustomizationDataMaskChange={
          handlePendingCustomizationDataMaskChange
        }
        toggleFiltersBar={verticalConfig.toggleFiltersBar}
        width={verticalConfig.width}
        clearAllTriggers={clearAllTriggers}
        onClearAllComplete={handleClearAllComplete}
      />
    ) : null;

  return hidden ? (
    <HiddenFilterBar>{filterBarComponent}</HiddenFilterBar>
  ) : (
    filterBarComponent
  );
};
export default memo(FilterBar);
