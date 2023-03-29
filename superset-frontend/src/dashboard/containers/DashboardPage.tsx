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
import React, { FC, useEffect, useMemo, useRef } from 'react';
import { Global } from '@emotion/react';
import { useHistory } from 'react-router-dom';
import {
  CategoricalColorNamespace,
  FeatureFlag,
  getSharedLabelColor,
  isFeatureEnabled,
  SharedLabelColorSource,
  t,
  useTheme,
} from '@superset-ui/core';
import pick from 'lodash/pick';
import { useDispatch, useSelector } from 'react-redux';
import { useToasts } from 'src/components/MessageToasts/withToasts';
import Loading from 'src/components/Loading';
import {
  useDashboard,
  useDashboardCharts,
  useDashboardDatasets,
} from 'src/hooks/apiResources';
import { hydrateDashboard } from 'src/dashboard/actions/hydrate';
import { setDatasources } from 'src/dashboard/actions/datasources';
import injectCustomCss from 'src/dashboard/util/injectCustomCss';
import setupPlugins from 'src/setup/setupPlugins';

import {
  getItem,
  LocalStorageKeys,
  setItem,
} from 'src/utils/localStorageHelpers';
import { URL_PARAMS } from 'src/constants';
import { getUrlParam } from 'src/utils/urlUtils';
import { getFilterSets } from 'src/dashboard/actions/nativeFilters';
import { setDatasetsStatus } from 'src/dashboard/actions/dashboardState';
import {
  getFilterValue,
  getPermalinkValue,
} from 'src/dashboard/components/nativeFilters/FilterBar/keyValue';
import { DashboardContextForExplore } from 'src/types/DashboardContextForExplore';
import shortid from 'shortid';
import { RootState } from '../types';
import { getActiveFilters } from '../util/activeDashboardFilters';
import {
  chartContextMenuStyles,
  filterCardPopoverStyle,
  headerStyles,
} from '../styles';

export const DashboardPageIdContext = React.createContext('');

setupPlugins();
const DashboardContainer = React.lazy(
  () =>
    import(
      /* webpackChunkName: "DashboardContainer" */
      /* webpackPreload: true */
      'src/dashboard/containers/Dashboard'
    ),
);

const originalDocumentTitle = document.title;

type PageProps = {
  idOrSlug: string;
};

const getDashboardContextLocalStorage = () => {
  const dashboardsContexts = getItem(
    LocalStorageKeys.dashboard__explore_context,
    {},
  );
  // A new dashboard tab id is generated on each dashboard page opening.
  // We mark ids as redundant when user leaves the dashboard, because they won't be reused.
  // Then we remove redundant dashboard contexts from local storage in order not to clutter it
  return Object.fromEntries(
    Object.entries(dashboardsContexts).filter(
      ([, value]) => !value.isRedundant,
    ),
  );
};

const updateDashboardTabLocalStorage = (
  dashboardPageId: string,
  dashboardContext: DashboardContextForExplore,
) => {
  const dashboardsContexts = getDashboardContextLocalStorage();
  setItem(LocalStorageKeys.dashboard__explore_context, {
    ...dashboardsContexts,
    [dashboardPageId]: dashboardContext,
  });
};

const useSyncDashboardStateWithLocalStorage = () => {
  const dashboardPageId = useMemo(() => shortid.generate(), []);
  const dashboardContextForExplore = useSelector<
    RootState,
    DashboardContextForExplore
  >(({ dashboardInfo, dashboardState, nativeFilters, dataMask }) => ({
    labelColors: dashboardInfo.metadata?.label_colors || {},
    sharedLabelColors: dashboardInfo.metadata?.shared_label_colors || {},
    colorScheme: dashboardState?.colorScheme,
    chartConfiguration: dashboardInfo.metadata?.chart_configuration || {},
    nativeFilters: Object.entries(nativeFilters.filters).reduce(
      (acc, [key, filterValue]) => ({
        ...acc,
        [key]: pick(filterValue, ['chartsInScope']),
      }),
      {},
    ),
    dataMask,
    dashboardId: dashboardInfo.id,
    filterBoxFilters: getActiveFilters(),
    dashboardPageId,
  }));

  useEffect(() => {
    updateDashboardTabLocalStorage(dashboardPageId, dashboardContextForExplore);
    return () => {
      // mark tab id as redundant when dashboard unmounts - case when user opens
      // Explore in the same tab
      updateDashboardTabLocalStorage(dashboardPageId, {
        ...dashboardContextForExplore,
        isRedundant: true,
      });
    };
  }, [dashboardContextForExplore, dashboardPageId]);
  return dashboardPageId;
};

export const DashboardPage: FC<PageProps> = ({ idOrSlug }: PageProps) => {
  const theme = useTheme();
  const dispatch = useDispatch();
  const history = useHistory();
  const dashboardPageId = useSyncDashboardStateWithLocalStorage();
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
  const { dashboard_title, css, metadata, id = 0 } = dashboard || {};

  useEffect(() => {
    // mark tab id as redundant when user closes browser tab - a new id will be
    // generated next time user opens a dashboard and the old one won't be reused
    const handleTabClose = () => {
      const dashboardsContexts = getDashboardContextLocalStorage();
      setItem(LocalStorageKeys.dashboard__explore_context, {
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
      let activeTabs: string[] | undefined;
      if (permalinkKey) {
        const permalinkValue = await getPermalinkValue(permalinkKey);
        if (permalinkValue) {
          ({ dataMask, activeTabs } = permalinkValue.state);
        }
      } else if (nativeFilterKeyValue) {
        dataMask = await getFilterValue(id, nativeFilterKeyValue);
      }
      if (isOldRison) {
        dataMask = isOldRison;
      }

      if (readyToRender) {
        if (!isDashboardHydrated.current) {
          isDashboardHydrated.current = true;
          if (isFeatureEnabled(FeatureFlag.DASHBOARD_NATIVE_FILTERS_SET)) {
            // only initialize filterset once
            dispatch(getFilterSets(id));
          }
        }
        dispatch(
          hydrateDashboard({
            history,
            dashboard,
            charts,
            activeTabs,
            dataMask,
          }),
        );
      }
      return null;
    }
    if (id) getDataMaskApplied();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readyToRender]);

  useEffect(() => {
    if (dashboard_title) {
      document.title = dashboard_title;
    }
    return () => {
      document.title = originalDocumentTitle;
    };
  }, [dashboard_title]);

  useEffect(() => {
    if (typeof css === 'string') {
      // returning will clean up custom css
      // when dashboard unmounts or changes
      return injectCustomCss(css);
    }
    return () => {};
  }, [css]);

  useEffect(() => {
    const sharedLabelColor = getSharedLabelColor();
    sharedLabelColor.source = SharedLabelColorSource.dashboard;
    return () => {
      // clean up label color
      const categoricalNamespace = CategoricalColorNamespace.getNamespace(
        metadata?.color_namespace,
      );
      categoricalNamespace.resetColors();
      sharedLabelColor.clear();
    };
  }, [metadata?.color_namespace]);

  useEffect(() => {
    if (datasetsApiError) {
      addDangerToast(
        t('Error loading chart datasources. Filters may not work correctly.'),
      );
    } else {
      dispatch(setDatasources(datasets));
    }
  }, [addDangerToast, datasets, datasetsApiError, dispatch]);

  if (error) throw error; // caught in error boundary
  if (!readyToRender || !isDashboardHydrated.current) return <Loading />;

  return (
    <>
      <Global
        styles={[
          filterCardPopoverStyle(theme),
          headerStyles(theme),
          chartContextMenuStyles(theme),
        ]}
      />
      <DashboardPageIdContext.Provider value={dashboardPageId}>
        <DashboardContainer />
      </DashboardPageIdContext.Provider>
    </>
  );
};

export default DashboardPage;
