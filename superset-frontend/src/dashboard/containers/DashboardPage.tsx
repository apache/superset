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
import { createContext, FC, useEffect, useMemo, useRef, useState } from 'react';
import { Global } from '@emotion/react';
import { useHistory } from 'react-router-dom';
import type { dashboards } from '@apache-superset/core';
import { t } from '@apache-superset/core/translation';
import { useTheme } from '@apache-superset/core/theme';
import { useDispatch, useSelector } from 'react-redux';
import { useToasts } from 'src/components/MessageToasts/withToasts';
import { EmptyState, Loading } from '@superset-ui/core/components';
import {
  useDashboard,
  useDashboardCharts,
  useDashboardDatasets,
} from 'src/hooks/apiResources';
import { hydrateDashboard } from 'src/dashboard/actions/hydrate';
import { clearDashboardHistory } from 'src/dashboard/actions/dashboardLayout';
import { setDatasources } from 'src/dashboard/actions/datasources';
import injectCustomCss from 'src/dashboard/util/injectCustomCss';
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
import CrudThemeProvider from 'src/components/CrudThemeProvider';
import { useUiConfig } from 'src/components/UiConfigContext';
import DashboardRendererHost from 'src/core/dashboards/DashboardRendererHost';
import type { DashboardChartStates } from 'src/dashboard/types/chartState';

import { nanoid } from 'nanoid';
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

type PageProps = {
  idOrSlug: string;
};

/**
 * Initial dashboard state resolved from the URL (permalink, filter key, or
 * legacy rison params) before any renderer mounts.
 */
type InitialRendererState = {
  dataMask: dashboards.DashboardDataMask;
  activeTabs?: string[];
  anchor?: string;
};

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
  const uiConfig = useUiConfig();
  const editMode = useSelector<RootState, boolean>(
    state => !!state.dashboardState?.editMode,
  );
  const [initialRendererState, setInitialRendererState] =
    useState<InitialRendererState>();

  const error = dashboardApiError || chartsApiError;
  // Only 404 gets a graceful not-found state; a 403 (access denied) still
  // surfaces through the error boundary.
  const isNotFoundError = (error as SupersetApiError | null)?.status === 404;
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
        setInitialRendererState({
          dataMask: dataMask as dashboards.DashboardDataMask,
          activeTabs: activeTabs ?? undefined,
          anchor,
        });

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

  const rendererProps = useMemo<
    dashboards.DashboardRendererProps | undefined
  >(() => {
    if (!dashboard || !charts || !initialRendererState) return undefined;
    return {
      dashboard: {
        id: dashboard.id,
        uuid: dashboard.uuid,
        slug: dashboard.slug,
        title: dashboard.dashboard_title,
        css: dashboard.css,
        metadata: dashboard.metadata ?? {},
        layout: dashboard.position_data ?? {},
        isPublished: dashboard.published,
        isManagedExternally: dashboard.is_managed_externally,
      },
      // The API payloads satisfy the contract shapes structurally, but the
      // host types (Chart, Datasource) lack the contract's index signatures,
      // so the conversion has to go through `unknown`.
      charts: charts as unknown as dashboards.DashboardChart[],
      datasets: (datasets ?? []) as unknown as dashboards.DashboardDataset[],
      initialDataMask: initialRendererState.dataMask,
      initialActiveTabs: initialRendererState.activeTabs,
      initialAnchor: initialRendererState.anchor,
      uiConfig: {
        hideTitle: uiConfig.hideTitle,
        hideTab: uiConfig.hideTab,
        hideChartControls: uiConfig.hideChartControls,
        emitDataMasks: uiConfig.emitDataMasks,
      },
    };
  }, [dashboard, charts, datasets, initialRendererState, uiConfig]);

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
      {readyToRender && hasDashboardInfoInitiated && rendererProps ? (
        <>
          <SyncDashboardState dashboardPageId={dashboardPageId} />
          <DashboardPageIdContext.Provider value={dashboardPageId}>
            <CrudThemeProvider
              theme={reduxTheme !== undefined ? reduxTheme : dashboard?.theme}
            >
              <DashboardRendererHost editMode={editMode} {...rendererProps} />
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
