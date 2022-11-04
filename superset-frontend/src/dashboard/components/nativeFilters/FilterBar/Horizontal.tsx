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

import React, { useEffect, useState, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  DataMaskStateWithId,
  DataMaskWithId,
  Filter,
  DataMask,
  styled,
  t,
  SLOW_DEBOUNCE,
  isNativeFilter,
} from '@superset-ui/core';
import Icons from 'src/components/Icons';
import { useHistory } from 'react-router-dom';
import { usePrevious } from 'src/hooks/usePrevious';
import { updateDataMask, clearDataMask } from 'src/dataMask/actions';
import { useImmer } from 'use-immer';
import { isEmpty, isEqual, debounce } from 'lodash';
import Loading from 'src/components/Loading';
import { getInitialDataMask } from 'src/dataMask/reducer';
import { URL_PARAMS } from 'src/constants';
import { getUrlParam } from 'src/utils/urlUtils';
import { useTabId } from 'src/hooks/useTabId';
import { FilterBarLocation, RootState } from 'src/dashboard/types';
import { checkIsApplyDisabled } from './utils';
import {
  useNativeFiltersDataMask,
  useFilters,
  useFilterUpdates,
  useInitialization,
} from './state';
import { createFilterKey, updateFilterKey } from './keyValue';
import FilterControls from './FilterControls/FilterControls';
import ActionButtons from './ActionButtons';
import { getFilterBarTestId } from './utils';
import FilterBarLocationSelect from './FilterBarLocationSelect';
import FilterConfigurationLink from './FilterConfigurationLink';

export interface HorizontalFiltersBarProps {
  directPathToChild?: string[];
}

const HorizontalBar = styled.div`
  ${({ theme }) => `
  display: flex;
  flex-direction: row;
  flex-wrap: nowrap;
  align-items: center;
  justify-content: flex-start;
  height: 48px;
  background: ${theme.colors.grayscale.light5};
  box-shadow: inset 0px -2px 2px -1px ${theme.colors.grayscale.light2};
  padding: 0 ${theme.gridUnit * 4}px;
`}
`;

const FilterBarEmptyStateContainer = styled.div`
  ${({ theme }) => `
  margin: 0 ${theme.gridUnit * 2}px;
  font-weight: ${theme.typography.weights.bold};
`}
`;

const FiltersLinkContainer = styled.div<{ hasFilters: boolean }>`
  ${({ theme, hasFilters }) => `
  padding: 0 ${theme.gridUnit * 2}px;
  border-right: ${
    hasFilters ? `1px solid ${theme.colors.grayscale.light2}` : 0
  };

  button {
    display: flex;
    align-items: center;
    text-transform: capitalize;
    font-weight: ${theme.typography.weights.normal};
    color: ${theme.colors.primary.base};
    > .anticon + span, > .anticon {
        margin-right: 0;
        margin-left: 0;
      }
  }
`}
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
      history.location.pathname = window.location.pathname;
      history.replace({
        search: newParams.toString(),
      });
    }
  },
  SLOW_DEBOUNCE,
);

const HorizontalFilterBar: React.FC<HorizontalFiltersBarProps> = ({
  directPathToChild,
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
  const filterValues = Object.values(filters);
  const nativeFilterValues = filterValues.filter(isNativeFilter);
  const dashboardId = useSelector<any, number>(
    ({ dashboardInfo }) => dashboardInfo?.id,
  );
  const previousDashboardId = usePrevious(dashboardId);
  const canEdit = useSelector<RootState, boolean>(
    ({ dashboardInfo }) => dashboardInfo.dash_edit_perm,
  );

  const handleFilterSelectionChange = useCallback(
    (
      filter: Pick<Filter, 'id'> & Partial<Filter>,
      dataMask: Partial<DataMask>,
    ) => {
      setDataMaskSelected(draft => {
        // force instant updating on initialization for filters with `requiredFirst` is true or instant filters
        if (
          // filterState.value === undefined - means that value not initialized
          dataMask.filterState?.value !== undefined &&
          dataMaskSelected[filter.id]?.filterState?.value === undefined &&
          filter.requiredFirst
        ) {
          dispatch(updateDataMask(filter.id, dataMask));
        }

        draft[filter.id] = {
          ...(getInitialDataMask(filter.id) as DataMaskWithId),
          ...dataMask,
        };
      });
    },
    [dataMaskSelected, dispatch, setDataMaskSelected],
  );

  useEffect(() => {
    if (previousFilters && dashboardId === previousDashboardId) {
      const updates = {};
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
          updates[currentFilter.id] = getInitialDataMask(currentFilter.id);
        }
      });

      if (!isEmpty(updates)) {
        setDataMaskSelected(draft => ({ ...draft, ...updates }));
        Object.keys(updates).forEach(key => dispatch(clearDataMask(key)));
      }
    }
  }, [
    JSON.stringify(filters),
    JSON.stringify(previousFilters),
    previousDashboardId,
  ]);

  const dataMaskAppliedText = JSON.stringify(dataMaskApplied);

  useEffect(() => {
    setDataMaskSelected(() => dataMaskApplied);
  }, [dataMaskAppliedText, setDataMaskSelected]);

  useEffect(() => {
    publishDataMask(history, dashboardId, updateKey, dataMaskApplied, tabId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dashboardId, dataMaskAppliedText, history, updateKey, tabId]);

  const handleApply = useCallback(() => {
    const filterIds = Object.keys(dataMaskSelected);
    setUpdateKey(1);
    filterIds.forEach(filterId => {
      if (dataMaskSelected[filterId]) {
        dispatch(updateDataMask(filterId, dataMaskSelected[filterId]));
      }
    });
  }, [dataMaskSelected, dispatch]);

  const handleClearAll = useCallback(() => {
    const filterIds = Object.keys(dataMaskSelected);
    filterIds.forEach(filterId => {
      if (dataMaskSelected[filterId]) {
        dispatch(clearDataMask(filterId));
        setDataMaskSelected(draft => {
          if (draft[filterId].filterState?.value !== undefined) {
            draft[filterId].filterState!.value = undefined;
          }
        });
      }
    });
  }, [dataMaskSelected, dispatch, setDataMaskSelected]);

  useFilterUpdates(dataMaskSelected, setDataMaskSelected);
  const isApplyDisabled = checkIsApplyDisabled(
    dataMaskSelected,
    dataMaskApplied,
    nativeFilterValues,
  );
  const isInitialized = useInitialization();
  const hasFilters = filterValues.length > 0;

  return (
    <HorizontalBar {...getFilterBarTestId()}>
      {!isInitialized ? (
        <Loading position="inline-centered" />
      ) : (
        <>
          {canEdit && <FilterBarLocationSelect />}
          {!hasFilters && (
            <FilterBarEmptyStateContainer>
              {t('No filters are currently added to this dashboard.')}
            </FilterBarEmptyStateContainer>
          )}
          {canEdit && (
            <FiltersLinkContainer hasFilters={hasFilters}>
              <FilterConfigurationLink
                dashboardId={dashboardId}
                createNewOnOpen={filterValues.length === 0}
              >
                <Icons.PlusSmall /> {t('Add/Edit Filters')}
              </FilterConfigurationLink>
            </FiltersLinkContainer>
          )}
          {hasFilters && (
            <FilterControls
              dataMaskSelected={dataMaskSelected}
              directPathToChild={directPathToChild}
              onFilterSelectionChange={handleFilterSelectionChange}
            />
          )}
          <ActionButtons
            orientation={FilterBarLocation.HORIZONTAL}
            onApply={handleApply}
            onClearAll={handleClearAll}
            dataMaskSelected={dataMaskSelected}
            dataMaskApplied={dataMaskApplied}
            isApplyDisabled={isApplyDisabled}
          />
        </>
      )}
    </HorizontalBar>
  );
};
export default React.memo(HorizontalFilterBar);
