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
import { useDispatch } from 'react-redux';
import { useToasts } from 'src/components/MessageToasts/withToasts';
import { EmptyState, Loading } from '@superset-ui/core/components';
import {
  useDashboard,
  useDashboardCharts,
  useDashboardDatasets,
} from 'src/hooks/apiResources';
import { hydrateDashboard } from 'src/dashboard/actions/hydrate';
import { setDatasources } from 'src/dashboard/actions/datasources';
import injectCustomCss from 'src/dashboard/util/injectCustomCss';
import { dropHydrationSnapshot } from 'src/dashboard/util/rebaselineHydrationDashboardInfo';
import {
  getAllActiveFilters,
  getRelevantDataMask,
} from 'src/dashboard/util/activeAllDashboardFilters';
import { getActiveFilters } from 'src/dashboard/util/activeDashboardFilters';
import { LocalStorageKeys, setItem } from 'src/utils/localStorageHelpers';
import { URL_PARAMS } from 'src/constants';
import { getUrlParam } from 'src/utils/urlUtils';
import { sanitizeDocumentTitle } from 'src/utils/sanitizeDocumentTitle';
import { DASHBOARD_HEADER_ID } from 'src/dashboard/util/constants';
import {
  useDashboardStateStore,
  useNativeFiltersStore,
  useDashboardInfoStore,
  useDashboardLayoutStore,
} from 'src/dashboard/stores';
import { useDataMaskStore } from 'src/dataMask/useDataMaskStore';
import { getFilterValue, getPermalinkValue } from 'src/dashboard/queries';
import DashboardContainer from 'src/dashboard/containers/Dashboard';
import CrudThemeProvider from 'src/components/CrudThemeProvider';
import type { DashboardChartStates } from 'src/dashboard/types/chartState';

import { nanoid } from 'nanoid';
import type { ActiveFilters } from '../types';
import {
  chartContextMenuStyles,
  filterCardPopoverStyle,
  focusStyle,
  headerStyles,
  chartHeaderStyles,
} from '../styles';
import SyncDashboardState, {
  getDashboardContextLocalStorage,
} from './SyncDashboardState';
import { AutoRefreshProvider } from '../contexts/AutoRefreshContext';
import { Filter, PartialFilters, SupersetApiError } from '@superset-ui/core';
import { RoutePaths } from 'src/views/routePaths';
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

export const DashboardPage: FC<PageProps> = ({ idOrSlug }: PageProps) => {
  const theme = useTheme();
  const dispatch = useDispatch();
  const history = useHistory();
  const dashboardPageId = useMemo(() => nanoid(), []);
  const hasDashboardInfoInitiated = useDashboardInfoStore(
    s => Object.keys(s.dashboardInfo).length > 0,
  );
  const reduxTheme = useDashboardInfoStore(s => s.dashboardInfo.theme);
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
  // Only 404 gets a graceful not-found state; a 403 (access denied) still
  // surfaces through the error boundary.
  const isNotFoundError = (error as SupersetApiError | null)?.status === 404;
  const readyToRender = Boolean(dashboard && charts);
  const { dashboard_title, id = 0 } = dashboard || {};

  // The live title lives in the layout store and is persisted via an in-SPA
  // save with no full reload, so the useDashboard() API result can be stale.
  // Track the live title so the browser tab stays in sync after a rename.
  const liveDashboardTitle = useDashboardLayoutStore(
    s => s.layout?.[DASHBOARD_HEADER_ID]?.meta?.text,
  );
  // Only trust the live layout title once the layout belongs to the dashboard
  // being shown. During SPA dashboard-to-dashboard navigation the previous
  // dashboard's layout lingers until the new one hydrates, so fall back to the
  // freshly fetched API title until the hydrated dashboard matches.
  const hydratedDashboardId = useDashboardInfoStore(s => s.dashboardInfo?.id);
  const pageTitle =
    (hydratedDashboardId === id ? liveDashboardTitle : undefined) ||
    dashboard_title;

  // Get CSS from dashboardInfo (unified properties location)
  const css = useDashboardInfoStore(s => s.dashboardInfo.css) || dashboard?.css;

  // Release the in-place-discard snapshot when leaving the dashboard. It is
  // cached with gcTime Infinity, so without this it accumulates one full payload
  // per dashboard visited across an SPA session.
  useEffect(
    () => () => {
      if (id) dropHydrationSnapshot(id);
    },
    [id],
  );

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
    useDashboardStateStore.getState().setDatasetsStatus(status);
  }, [status]);

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
            DashboardChartStates | undefined;
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
      // A missing dashboard also 404s its datasets; the not-found state covers it.
      if (!isNotFoundError) {
        addDangerToast(
          t('Error loading chart datasources. Filters may not work correctly.'),
        );
      }
    } else {
      dispatch(setDatasources(datasets));
    }
  }, [addDangerToast, datasets, datasetsApiError, dispatch, isNotFoundError]);

  const dataMask = useDataMaskStore(s => s.dataMask);
  const nativeFiltersMap = useNativeFiltersStore(s => s.filters);
  const chartConfiguration = useDashboardInfoStore(
    s => s.dashboardInfo.metadata?.chart_configuration,
  );
  const allSliceIds = useDashboardStateStore(s => s.sliceIds);

  const relevantDataMask = useMemo(
    () => getRelevantDataMask(dataMask, 'ownState'),
    [dataMask],
  );
  const activeFilters = useMemo(
    () => ({
      ...getActiveFilters(),
      ...getAllActiveFilters({
        chartConfiguration,
        nativeFilters: nativeFiltersMap,
        dataMask,
        allSliceIds,
      }),
    }),
    [chartConfiguration, nativeFiltersMap, dataMask, allSliceIds],
  );

  if (error && !isNotFoundError) throw error; // caught in error boundary

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

  if (error && !isNotFoundError) throw error; // caught in error boundary

  const DashboardBuilderComponent = useMemo(() => <DashboardBuilder />, []);

  if (isNotFoundError) {
    return (
      <EmptyState
        size="large"
        image="empty-dashboard.svg"
        title={t('This dashboard does not exist')}
        description={t(
          'The dashboard you are looking for may have been deleted or moved.',
        )}
        buttonText={t('See all dashboards')}
        buttonAction={() => history.push(RoutePaths.DASHBOARD_LIST)}
      />
    );
  }

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
