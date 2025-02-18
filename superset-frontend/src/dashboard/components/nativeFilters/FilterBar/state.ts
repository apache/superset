// DODO was here
/* eslint-disable no-param-reassign */
import { useSelector } from 'react-redux';
import {
  DataMaskState,
  DataMaskStateWithId,
  DataMaskWithId,
  Filter,
  Filters,
  FilterSets as FilterSetsType, // DODO added 44211751
} from '@superset-ui/core';
import { useEffect, useMemo, useState } from 'react';
import { ChartsState, RootState } from 'src/dashboard/types';
import { NATIVE_FILTER_PREFIX } from '../FiltersConfigModal/utils';

// DODO added start 44211751
export const useFilterSets = () =>
  useSelector<any, FilterSetsType>(
    state => state.nativeFilters.filterSets || {},
  );

export const usePendingFilterSetId = () =>
  useSelector<any, number | undefined>(
    state => state.nativeFilters.pendingFilterSetId,
  );
// DODO added stop 44211751

export const useFilters = () => {
  const preselectedNativeFilters = useSelector<any, Filters>(
    state => state.dashboardState?.preselectNativeFilters,
  );
  const nativeFilters = useSelector<RootState, Filters>(
    state => state.nativeFilters.filters,
  );
  return useMemo(
    () =>
      Object.entries(nativeFilters).reduce(
        (acc, [filterId, filter]: [string, Filter]) => ({
          ...acc,
          [filterId]: {
            ...filter,
            preselect: preselectedNativeFilters?.[filterId],
          },
        }),
        {} as Filters,
      ),
    [nativeFilters, preselectedNativeFilters],
  );
};

export const useNativeFiltersDataMask = () => {
  const dataMask = useSelector<RootState, DataMaskStateWithId>(
    state => state.dataMask,
  );

  return useMemo(
    () =>
      Object.values(dataMask)
        .filter((item: DataMaskWithId) =>
          String(item.id).startsWith(NATIVE_FILTER_PREFIX),
        )
        .reduce(
          (prev, next: DataMaskWithId) => ({ ...prev, [next.id]: next }),
          {},
        ) as DataMaskStateWithId,
    [dataMask],
  );
};

export const useFilterUpdates = (
  dataMaskSelected: DataMaskState,
  setDataMaskSelected: (arg0: (arg0: DataMaskState) => void) => void,
) => {
  const filters = useFilters();
  const dataMaskApplied = useNativeFiltersDataMask();
  useEffect(() => {
    // Remove deleted filters from local state
    Object.keys(dataMaskSelected).forEach(selectedId => {
      if (!filters[selectedId]) {
        setDataMaskSelected(draft => {
          delete draft[selectedId];
        });
      }
    });
  }, [dataMaskApplied, dataMaskSelected, filters, setDataMaskSelected]);
};

// Load filters after charts loaded
export const useInitialization = () => {
  const [isInitialized, setIsInitialized] = useState<boolean>(false);
  const filters = useFilters();
  const charts = useSelector<RootState, ChartsState>(state => state.charts);

  // We need to know how much charts now shown on dashboard to know how many of all charts should be loaded
  let numberOfLoadingCharts = 0;
  if (!isInitialized) {
    numberOfLoadingCharts = document.querySelectorAll(
      '[data-ui-anchor="chart"]',
    ).length;
  }
  useEffect(() => {
    if (isInitialized) {
      return;
    }

    if (Object.values(filters).find(({ requiredFirst }) => requiredFirst)) {
      setIsInitialized(true);
      return;
    }

    // For some dashboards may be there are no charts on first page,
    // so we check up to 1 sec if there is at least on chart to load
    let filterTimeout: NodeJS.Timeout;
    if (numberOfLoadingCharts === 0) {
      filterTimeout = setTimeout(() => {
        setIsInitialized(true);
      }, 1000);
    }

    // @ts-ignore
    if (numberOfLoadingCharts > 0 && filterTimeout !== undefined) {
      clearTimeout(filterTimeout);
    }

    const numberOfLoadedCharts = Object.values(charts).filter(
      ({ chartStatus }) => chartStatus !== 'loading',
    ).length;
    if (
      numberOfLoadingCharts > 0 &&
      numberOfLoadedCharts >= numberOfLoadingCharts
    ) {
      setIsInitialized(true);
    }
  }, [charts, isInitialized, numberOfLoadingCharts]);

  return isInitialized;
};
