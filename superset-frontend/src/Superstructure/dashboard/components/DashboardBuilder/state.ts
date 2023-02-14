// DODO-changed
import { useSelector } from 'react-redux';
import { FeatureFlag, isFeatureEnabled } from 'src/featureFlags';
import { useEffect, useState } from 'react';
import { URL_PARAMS } from 'src/constants';
import { getUrlParam } from 'src/utils/urlUtils';
import { RootState } from 'src/dashboard/types';
import {
  useFilters,
  useNativeFiltersDataMask,
} from 'src/dashboard/components/nativeFilters/FilterBar/state';
import { Filter } from 'src/dashboard/components/nativeFilters/types';

// eslint-disable-next-line import/prefer-default-export
export const useNativeFilters = () => {
  const [isInitialized, setIsInitialized] = useState(false);
  const [dashboardFiltersOpen, setDashboardFiltersOpen] = useState(
    getUrlParam(URL_PARAMS.showFilters) ?? true,
  );
  const showNativeFilters = useSelector<RootState, boolean>(
    state => state.dashboardInfo.metadata?.show_native_filters,
  );
  const canEdit = useSelector<RootState, boolean>(
    ({ dashboardInfo }) => dashboardInfo.dash_edit_perm,
  );

  const filters = useFilters();
  const filterValues = Object.values<Filter>(filters);

  const nativeFiltersEnabled =
    showNativeFilters &&
    isFeatureEnabled(FeatureFlag.DASHBOARD_NATIVE_FILTERS) &&
    (canEdit || (!canEdit && filterValues.length !== 0));

  const requiredFirstFilter = filterValues.filter(
    filter => filter.requiredFirst,
  );
  const dataMask = useNativeFiltersDataMask();
  const showDashboard =
    isInitialized ||
    !nativeFiltersEnabled ||
    !(
      nativeFiltersEnabled &&
      requiredFirstFilter.length &&
      requiredFirstFilter.find(
        ({ id }) => dataMask[id]?.filterState?.value === undefined,
      )
    );

  const toggleDashboardFiltersOpen = (visible?: boolean) => {
    setDashboardFiltersOpen(visible ?? !dashboardFiltersOpen);
  };

  useEffect(() => {
    if (
      filterValues.length === 0 &&
      dashboardFiltersOpen &&
      nativeFiltersEnabled
    ) {
      toggleDashboardFiltersOpen(false);
    }
  }, [filterValues.length]);

  useEffect(() => {
    if (showDashboard) {
      setIsInitialized(true);
    }
  }, [showDashboard]);

  return {
    showDashboard,
    dashboardFiltersOpen,
    toggleDashboardFiltersOpen,
    nativeFiltersEnabled,
  };
};
