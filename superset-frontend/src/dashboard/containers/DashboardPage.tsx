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
import { createContext, lazy, FC, useEffect, useMemo, useRef } from 'react';
import { Global } from '@emotion/react';
import { useHistory } from 'react-router-dom';
import { t } from '@apache-superset/core/translation';
import { useTheme } from '@apache-superset/core/theme';
import { useDispatch, useSelector } from 'react-redux';
import { createSelector } from '@reduxjs/toolkit';
import { useToasts } from 'src/components/MessageToasts/withToasts';
import { Loading } from '@superset-ui/core/components';
import {
  useDashboard,
  useDashboardCharts,
  useDashboardDatasets,
} from 'src/hooks/apiResources';
import { hydrateDashboard } from 'src/dashboard/actions/hydrate';
import { clearDashboardHistory } from 'src/dashboard/actions/dashboardLayout';
import { setDatasources } from 'src/dashboard/actions/datasources';
import injectCustomCss from 'src/dashboard/util/injectCustomCss';
import {
  getAllActiveFilters,
  getRelevantDataMask,
} from 'src/dashboard/util/activeAllDashboardFilters';
import { getActiveFilters } from 'src/dashboard/util/activeDashboardFilters';
import { LocalStorageKeys, setItem } from 'src/utils/localStorageHelpers';
import { URL_PARAMS } from 'src/constants';
import { getUrlParam } from 'src/utils/urlUtils';
import { sanitizeDocumentTitle } from 'src/utils/sanitizeDocumentTitle';
import { setDatasetsStatus } from 'src/dashboard/actions/dashboardState';
import { DASHBOARD_HEADER_ID } from 'src/dashboard/util/constants';
import {
  getFilterValue,
  getPermalinkValue,
} from 'src/dashboard/components/nativeFilters/FilterBar/keyValue';
import DashboardContainer from 'src/dashboard/containers/Dashboard';
import CrudThemeProvider from 'src/components/CrudThemeProvider';
import type { DashboardChartStates } from 'src/dashboard/types/chartState';

import { nanoid } from 'nanoid';
import type { ActiveFilters } from '../types';
import { RootState } from '../types';
import {
  chartContextMenuStyles,
  filterCardPopoverStyle,
  focusStyle,
  headerStyles,
  chartHeaderStyles,
} from '../styles';
import SyncDashboardState, {
  getDashboardContextLocalStorage,
} from '../components/SyncDashboardState';
import { AutoRefreshProvider } from '../contexts/AutoRefreshContext';
import { Filter, PartialFilters } from '@superset-ui/core';
import {
  parseRisonFilters,
  risonFiltersToExtraFormDataFilters,
  getRisonFilterParam,
  prettifyRisonFilterUrl,
  injectRisonFiltersIntelligently,
  updateUrlWithUnmatchedFilters,
  RISON_UNMATCHED_DATAMASK_ID,
} from '../util/risonFilters';

type NativeFilterConfigEntry = Partial<Filter> & { id: string };

export const DashboardPageIdContext = createContext('');

const DashboardBuilder = lazy(
  () =>
    import(
      /* webpackChunkName: "DashboardContainer" */
      /* webpackPreload: true */
      'src/dashboard/components/DashboardBuilder/DashboardBuilder'
    ),
);

type PageProps = {
  idOrSlug: string;
};

// TODO: move to Dashboard.jsx when it's refactored to functional component
const selectRelevantDatamask = createSelector(
  (state: RootState) => state.dataMask, // the first argument accesses relevant data from global state
  dataMask => getRelevantDataMask(dataMask, 'ownState'), // the second parameter conducts the transformation
);

const selectChartConfiguration = (state: RootState) =>
  state.dashboardInfo.metadata?.chart_configuration;
const selectNativeFilters = (state: RootState) => state.nativeFilters.filters;
const selectDataMask = (state: RootState) => state.dataMask;
const selectAllSliceIds = (state: RootState) => state.dashboardState.sliceIds;
// TODO: move to Dashboard.jsx when it's refactored to functional component
const selectActiveFilters = createSelector(
  [
    selectChartConfiguration,
    selectNativeFilters,
    selectDataMask,
    selectAllSliceIds,
  ],
  (chartConfiguration, nativeFilters, dataMask, allSliceIds) => ({
    ...getActiveFilters(),
    ...getAllActiveFilters({
      // eslint-disable-next-line camelcase
      chartConfiguration,
      nativeFilters,
      dataMask,
      allSliceIds,
    }),
  }),
);

export const DashboardPage: FC<PageProps> = ({ idOrSlug }: PageProps) => {
  const theme = useTheme();
  const dispatch = useDispatch();
  const history = useHistory();
  const dashboardPageId = useMemo(() => nanoid(), []);
  const hasDashboardInfoInitiated = useSelector<RootState, boolean>(
    ({ dashboardInfo }) =>
      dashboardInfo && Object.keys(dashboardInfo).length > 0,
  );
  const reduxTheme = useSelector(
    (state: RootState) => state.dashboardInfo.theme,
  );
  const { addDangerToast } = useToasts();
  const { result: dashboard, error: dashboardApiError } =
    useDashboard(idOrSlug);
  const { result: charts, error: chartsApiError } =
    useDashboardCharts(idOrSlug);
  const {
    result: datasets,
    error: datasetsApiError,
    status,
  } = useDashboardDatasets(idOrSlug);
  const isDashboardHydrated = useRef(false);

  const error = dashboardApiError || chartsApiError;
  const readyToRender = Boolean(dashboard && charts);
  const { dashboard_title, id = 0 } = dashboard || {};

  // The live title is edited in Redux and persisted via an in-SPA save with no
  // full reload, so the useDashboard() API result can be stale. Track the live
  // title so the browser tab stays in sync after a rename.
  const liveDashboardTitle = useSelector<RootState, string | undefined>(
    state => state.dashboardLayout?.present?.[DASHBOARD_HEADER_ID]?.meta?.text,
  );
  // Only trust the live layout title once the layout belongs to the dashboard
  // being shown. During SPA dashboard-to-dashboard navigation the previous
  // dashboard's layout lingers until the new one hydrates, so fall back to the
  // freshly fetched API title until the hydrated dashboard matches.
  const hydratedDashboardId = useSelector<RootState, number | undefined>(
    state => state.dashboardInfo?.id,
  );
  const pageTitle =
    (hydratedDashboardId === id ? liveDashboardTitle : undefined) ||
    dashboard_title;

  // Get CSS from dashboardInfo (unified properties location)
  const css =
    useSelector((state: RootState) => state.dashboardInfo.css) ||
    dashboard?.css;

  useEffect(() => {
    // mark tab id as redundant when user closes browser tab - a new id will be
    // generated next time user opens a dashboard and the old one won't be reused
    const handleTabClose = () => {
      const dashboardsContexts = getDashboardContextLocalStorage();
      setItem(LocalStorageKeys.DashboardExploreContext, {
        ...dashboardsContexts,
        [dashboardPageId]: {
          ...dashboardsContexts[dashboardPageId],
          isRedundant: true,
        },
      });
    };
    window.addEventListener('beforeunload', handleTabClose);
    return () => {
      window.removeEventListener('beforeunload', handleTabClose);
    };
  }, [dashboardPageId]);

  useEffect(() => {
    dispatch(setDatasetsStatus(status));
  }, [dispatch, status]);

  useEffect(() => {
    // eslint-disable-next-line consistent-return
    async function getDataMaskApplied() {
      const permalinkKey = getUrlParam(URL_PARAMS.permalinkKey);
      const nativeFilterKeyValue = getUrlParam(URL_PARAMS.nativeFiltersKey);
      const isOldRison = getUrlParam(URL_PARAMS.nativeFilters);

      let dataMask = nativeFilterKeyValue || {};
      // activeTabs is initialized with undefined so that it doesn't override
      // the currently stored value when hydrating
      let activeTabs: string[] | null | undefined;
      let chartStates: DashboardChartStates | null | undefined;
      let anchor: string | undefined;
      if (permalinkKey) {
        const permalinkValue = await getPermalinkValue(permalinkKey);
        if (permalinkValue?.state) {
          ({ dataMask, activeTabs, anchor } = permalinkValue.state);
          chartStates = permalinkValue.state.chartStates as
            | DashboardChartStates
            | undefined;
        }
      } else if (nativeFilterKeyValue) {
        dataMask = await getFilterValue(id, nativeFilterKeyValue);
      }
      if (isOldRison) {
        // Normalize legacy `currentState` → `filterState`. Pre-2021 URLs stored
        // per-filter selections under `currentState`; modern dataMask uses
        // `filterState`. Without this copy the filter panel shows no active
        // selections even though extraFormData still applies the query filter.
        if (typeof isOldRison === 'object' && isOldRison !== null) {
          dataMask = Object.fromEntries(
            Object.entries(
              isOldRison as Record<string, Record<string, unknown>>,
            ).map(([filterId, entry]) => [
              filterId,
              entry?.currentState && !entry?.filterState
                ? { ...entry, filterState: entry.currentState }
                : entry,
            ]),
          );
        }
      }

      // Parse Rison URL filters with intelligent native filter injection
      const risonFilterParam = getRisonFilterParam();
      if (risonFilterParam) {
        const risonFilters = parseRisonFilters(risonFilterParam);
        if (risonFilters.length > 0) {
          // Convert native filter config array to keyed object for lookup
          const filterConfigArray = (dashboard?.metadata
            ?.native_filter_configuration ?? []) as NativeFilterConfigEntry[];
          const nativeFilters: PartialFilters = {};
          filterConfigArray.forEach(filter => {
            nativeFilters[filter.id] = filter;
          });
          const injectionResult = injectRisonFiltersIntelligently(
            risonFilters,
            nativeFilters,
            dataMask,
          );

          dataMask = injectionResult.updatedDataMask;

          // Unmatched filters apply via a synthetic dataMask entry: because no
          // entry in `nativeFilters` claims this id, `getAllActiveFilters`
          // falls through to `allSliceIds` and the filters scope to every chart.
          if (injectionResult.unmatchedFilters.length > 0) {
            const extraFormDataFilters = risonFiltersToExtraFormDataFilters(
              injectionResult.unmatchedFilters,
            );

            dataMask = {
              ...dataMask,
              [RISON_UNMATCHED_DATAMASK_ID]: {
                id: RISON_UNMATCHED_DATAMASK_ID,
                extraFormData: { filters: extraFormDataFilters },
                filterState: {},
                ownState: {},
              },
            };
          }

          // Rewrite the URL to drop matched filters in a single step, keeping
          // only unmatched ones (and prettifying their encoding). Going
          // through react-router's history keeps `history.location.search` in
          // sync so `publishDataMask` doesn't re-emit the original `f=`.
          const matchedCount =
            risonFilters.length - injectionResult.unmatchedFilters.length;
          if (matchedCount > 0) {
            updateUrlWithUnmatchedFilters(
              injectionResult.unmatchedFilters,
              history,
            );
          }
          if (injectionResult.unmatchedFilters.length > 0) {
            prettifyRisonFilterUrl();
          }
        }
      }

      if (readyToRender) {
        if (!isDashboardHydrated.current) {
          isDashboardHydrated.current = true;
        }
        dispatch(
          hydrateDashboard({
            history,
            dashboard: dashboard!,
            charts: charts!,
            activeTabs: activeTabs ?? null,
            dataMask,
            chartStates: chartStates ?? null,
          } as unknown as Parameters<typeof hydrateDashboard>[0]),
        );
        dispatch(clearDashboardHistory());

        // Scroll to anchor element if specified in permalink state
        if (anchor) {
          // Use setTimeout to ensure the DOM has been updated after hydration
          setTimeout(() => {
            const element = document.getElementById(anchor);
            if (element) {
              element.scrollIntoView({ behavior: 'smooth' });
            }
          }, 0);
        }
      }
      return null;
    }
    if (id) getDataMaskApplied();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readyToRender]);

  // Capture original title before any effects run
  const originalTitle = useMemo(() => document.title, []);

  // Update document title when dashboard title changes
  useEffect(() => {
    if (pageTitle) {
      document.title = sanitizeDocumentTitle(pageTitle);
    }
  }, [pageTitle]);

  // Restore original title on unmount
  useEffect(
    () => () => {
      document.title =
        originalTitle ||
        theme?.brandAppName ||
        theme?.brandLogoAlt ||
        'Superset';
    },
    [originalTitle, theme?.brandAppName, theme?.brandLogoAlt],
  );

  useEffect(() => {
    if (typeof css === 'string') {
      // returning will clean up custom css
      // when dashboard unmounts or changes
      return injectCustomCss(css);
    }
    return () => {};
  }, [css]);

  useEffect(() => {
    if (datasetsApiError) {
      addDangerToast(
        t('Error loading chart datasources. Filters may not work correctly.'),
      );
    } else {
      dispatch(setDatasources(datasets));
    }
  }, [addDangerToast, datasets, datasetsApiError, dispatch]);

  const relevantDataMask = useSelector(selectRelevantDatamask);
  const activeFilters = useSelector(selectActiveFilters);

  if (error) throw error; // caught in error boundary

  const globalStyles = useMemo(
    () => [
      filterCardPopoverStyle(),
      headerStyles(theme),
      chartContextMenuStyles(theme),
      focusStyle(theme),
      chartHeaderStyles(theme),
    ],
    [theme],
  );

  if (error) throw error; // caught in error boundary

  const DashboardBuilderComponent = useMemo(() => <DashboardBuilder />, []);
  return (
    <>
      <Global styles={globalStyles} />
      {readyToRender && hasDashboardInfoInitiated ? (
        <>
          <SyncDashboardState dashboardPageId={dashboardPageId} />
          <DashboardPageIdContext.Provider value={dashboardPageId}>
            <CrudThemeProvider
              theme={reduxTheme !== undefined ? reduxTheme : dashboard?.theme}
            >
              <AutoRefreshProvider>
                <DashboardContainer
                  activeFilters={activeFilters as ActiveFilters}
                  ownDataCharts={relevantDataMask}
                >
                  {DashboardBuilderComponent}
                </DashboardContainer>
              </AutoRefreshProvider>
            </CrudThemeProvider>
          </DashboardPageIdContext.Provider>
        </>
      ) : (
        <Loading />
      )}
    </>
  );
};

export default DashboardPage;
