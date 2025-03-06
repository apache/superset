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
import { useSelector } from 'react-redux';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { URL_PARAMS } from 'src/constants';
import { getUrlParam } from 'src/utils/urlUtils';
import { RootState } from 'src/dashboard/types';
import {
  useFilters,
  useNativeFiltersDataMask,
} from '../nativeFilters/FilterBar/state';

// eslint-disable-next-line import/prefer-default-export
export const useNativeFilters = () => {
  const [isInitialized, setIsInitialized] = useState(false);
  const canEdit = useSelector<RootState, boolean>(
    ({ dashboardInfo }) => dashboardInfo.dash_edit_perm,
  );

  const filters = useFilters();
  const filterValues = useMemo(() => Object.values(filters), [filters]);
  const expandFilters = getUrlParam(URL_PARAMS.expandFilters);
  const [dashboardFiltersOpen, setDashboardFiltersOpen] = useState(
    expandFilters ?? !!filterValues.length,
  );

  const nativeFiltersEnabled =
    canEdit || (!canEdit && filterValues.length !== 0);

  const requiredFirstFilter = useMemo(
    () => filterValues.filter(filter => filter.requiredFirst),
    [filterValues],
  );
  const dataMask = useNativeFiltersDataMask();

  const missingInitialFilters = useMemo(
    () =>
      requiredFirstFilter
        .filter(({ id }) => dataMask[id]?.filterState?.value === undefined)
        .map(({ name }) => name),
    [requiredFirstFilter, dataMask],
  );

  const showDashboard =
    isInitialized ||
    !nativeFiltersEnabled ||
    missingInitialFilters.length === 0;

  const toggleDashboardFiltersOpen = useCallback((visible?: boolean) => {
    setDashboardFiltersOpen(prevState => visible ?? !prevState);
  }, []);

  useEffect(() => {
    if (
      expandFilters === false ||
      (filterValues.length === 0 && nativeFiltersEnabled)
    ) {
      toggleDashboardFiltersOpen(false);
    } else {
      toggleDashboardFiltersOpen(true);
    }
  }, [filterValues.length]);

  useEffect(() => {
    if (showDashboard) {
      setIsInitialized(true);
    }
  }, [showDashboard]);

  return {
    showDashboard,
    missingInitialFilters,
    dashboardFiltersOpen,
    toggleDashboardFiltersOpen,
    nativeFiltersEnabled,
  };
};
