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

import { useDispatch, useSelector } from 'react-redux';
import {
  DataMaskStateWithId,
  DataMaskWithId,
  Filter,
  DataMask,
  isNativeFilter,
  usePrevious,
  styled,
} from '@superset-ui/core';
import { Constants } from '@superset-ui/core/components';
import { useHistory } from 'react-router-dom';
import { updateDataMask } from 'src/dataMask/actions';
import { useImmer } from 'use-immer';
import { isEmpty, isEqual, debounce } from 'lodash';
import { getInitialDataMask } from 'src/dataMask/reducer';
import { URL_PARAMS } from 'src/constants';
import { applicationRoot } from 'src/utils/getBootstrapData';
import { getUrlParam } from 'src/utils/urlUtils';
import { useTabId } from 'src/hooks/useTabId';
import { logEvent } from 'src/logger/actions';
import { LOG_ACTIONS_CHANGE_DASHBOARD_FILTER } from 'src/logger/LogUtils';
import { FilterBarOrientation, RootState } from 'src/dashboard/types';
import { UserWithPermissionsAndRoles } from 'src/types/bootstrapTypes';
import { checkIsApplyDisabled } from './utils';
import { FiltersBarProps } from './types';
import {
  useNativeFiltersDataMask,
  useFilters,
  useFilterUpdates,
  useInitialization,
} from './state';
import { createFilterKey, updateFilterKey } from './keyValue';
import ActionButtons from './ActionButtons';
import Horizontal from './Horizontal';
import Vertical from './Vertical';
import { useSelectFiltersInScope } from '../state';

// FilterBar is just being hidden as it must still
// render fully due to encapsulated logics
const HiddenFilterBar = styled.div`
  display: none;
`;

const EXCLUDED_URL_PARAMS: string[] = [
  URL_PARAMS.nativeFilters.name,
  URL_PARAMS.permalinkKey.name,
];

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
  const dataMaskApplied: DataMaskStateWithId = useNativeFiltersDataMask();
  const [dataMaskSelected, setDataMaskSelected] =
    useImmer<DataMaskStateWithId>(dataMaskApplied);
  const dispatch = useDispatch();
  const [updateKey, setUpdateKey] = useState(0);
  const tabId = useTabId();
  const filters = useFilters();
  const previousFilters = usePrevious(filters);
  const filterValues = useMemo(() => Object.values(filters), [filters]);
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

  const dataMaskSelectedRef = useRef(dataMaskSelected);
  dataMaskSelectedRef.current = dataMaskSelected;
  const handleFilterSelectionChange = useCallback(
    (
      filter: Pick<Filter, 'id'> & Partial<Filter>,
      dataMask: Partial<DataMask>,
    ) => {
      setDataMaskSelected(draft => {
        const isFirstTimeInitialization =
          !initializedFilters.has(filter.id) &&
          dataMaskSelectedRef.current[filter.id]?.filterState?.value ===
            undefined;

        // force instant updating on initialization for filters with `requiredFirst` is true or instant filters
        if (
          // filterState.value === undefined - means that value not initialized
          dataMask.filterState?.value !== undefined &&
          isFirstTimeInitialization &&
          filter.requiredFirst
        ) {
          dispatch(updateDataMask(filter.id, dataMask));
        }

        // Mark filter as initialized after getting its first value
        if (
          dataMask.filterState?.value !== undefined &&
          !initializedFilters.has(filter.id)
        ) {
          setInitializedFilters(prev => new Set(prev).add(filter.id));
        }

        const baseDataMask = {
          ...(getInitialDataMask(filter.id) as DataMaskWithId),
          ...dataMask,
        };

        // Recalculate validation status
        const hasRequiredValue =
          filter.controlValues?.enableEmptyFilter &&
          baseDataMask.filterState?.value == null;

        draft[filter.id] = {
          ...baseDataMask,
          filterState: {
            ...baseDataMask.filterState,
            validateStatus: hasRequiredValue ? 'error' : undefined,
          },
        };
      });
    },
    [dispatch, setDataMaskSelected, initializedFilters, setInitializedFilters],
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

  const dataMaskAppliedText = JSON.stringify(dataMaskApplied);

  useEffect(() => {
    setDataMaskSelected(() => dataMaskApplied);
  }, [dataMaskAppliedText, setDataMaskSelected]);

  useEffect(() => {
    // embedded users can't persist filter combinations
    if (user?.userId) {
      publishDataMask(history, dashboardId, updateKey, dataMaskApplied, tabId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dashboardId, dataMaskAppliedText, history, updateKey, tabId]);

  const handleApply = useCallback(() => {
    dispatch(logEvent(LOG_ACTIONS_CHANGE_DASHBOARD_FILTER, {}));
    setUpdateKey(1);

    Object.entries(dataMaskSelected).forEach(([filterId, dataMask]) => {
      if (dataMask) {
        dispatch(updateDataMask(filterId, dataMask));
      }
    });
  }, [dataMaskSelected, dispatch]);

  const handleClearAll = useCallback(() => {
    const newClearAllTriggers = { ...clearAllTriggers };
    // Clear all native filters, not just those in scope
    // This ensures dependent filters are cleared even if parent was cleared first
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
    setClearAllTriggers(newClearAllTriggers);
  }, [
    dataMaskSelected,
    nativeFilterValues,
    setDataMaskSelected,
    clearAllTriggers,
  ]);

  const handleClearAllComplete = useCallback((filterId: string) => {
    setClearAllTriggers(prev => {
      const newTriggers = { ...prev };
      delete newTriggers[filterId];
      return newTriggers;
    });
  }, []);

  useFilterUpdates(dataMaskSelected, setDataMaskSelected);
  const isApplyDisabled = checkIsApplyDisabled(
    dataMaskSelected,
    dataMaskApplied,
    filtersInScope.filter(isNativeFilter),
  );
  const isInitialized = useInitialization();

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
      />
    ),
    [
      orientation,
      verticalConfig?.width,
      handleApply,
      handleClearAll,
      dataMaskSelected,
      dataMaskAppliedText,
      isApplyDisabled,
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
        isInitialized={isInitialized}
        onSelectionChange={handleFilterSelectionChange}
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
        isInitialized={isInitialized}
        height={verticalConfig.height}
        offset={verticalConfig.offset}
        onSelectionChange={handleFilterSelectionChange}
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
