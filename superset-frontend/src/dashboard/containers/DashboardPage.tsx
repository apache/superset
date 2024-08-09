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
import { createContext, lazy, FC, useEffect, useMemo, useState } from 'react';
import { Global } from '@emotion/react';
import { useHistory } from 'react-router-dom';
import { DataMaskStateWithId, t, useTheme } from '@superset-ui/core';
import { useDispatch, useSelector } from 'react-redux';
import { useToasts } from 'src/components/MessageToasts/withToasts';
import Loading from 'src/components/Loading';
import {
  useDashboard,
  useDashboardCharts,
  useDashboardDatasets,
} from 'src/hooks/apiResources';
import {
  hydrateDashboard,
  hydrateDashboardActiveTabs,
  hydrateDashboardDataMask,
} from 'src/dashboard/actions/hydrate';
import { setDatasources } from 'src/dashboard/actions/datasources';
import injectCustomCss from 'src/dashboard/util/injectCustomCss';

import { LocalStorageKeys, setItem } from 'src/utils/localStorageHelpers';
import { URL_PARAMS } from 'src/constants';
import { getUrlParam } from 'src/utils/urlUtils';
import { setDatasetsStatus } from 'src/dashboard/actions/dashboardState';
import {
  getFilterValue,
  getPermalinkValue,
} from 'src/dashboard/components/nativeFilters/FilterBar/keyValue';
import DashboardContainer from 'src/dashboard/containers/Dashboard';

import { nanoid } from 'nanoid';
import { toInteger } from 'lodash';
import { DashboardInfo, RootState } from '../types';
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

export const DashboardPageIdContext = createContext('');
export const DashboardPageContext = createContext({
  hydrated: false,
});

const DashboardBuilder = lazy(
  () =>
    import(
      /* webpackChunkName: "DashboardContainer" */
      /* webpackPreload: true */
      'src/dashboard/components/DashboardBuilder/DashboardBuilder'
    ),
);

const originalDocumentTitle = document.title;

type PageProps = {
  idOrSlug: string | number;
};

export const DashboardPage: FC<PageProps> = ({ idOrSlug }: PageProps) => {
  const theme = useTheme();
  const dispatch = useDispatch();
  const history = useHistory();
  const dashboardPageId = useMemo(() => nanoid(), []);
  const dashboardInfo = useSelector<RootState, DashboardInfo | null>(
    ({ dashboardInfo }) =>
      dashboardInfo &&
      Object.keys(dashboardInfo).length > 0 &&
      (dashboardInfo.id === toInteger(idOrSlug) ||
        dashboardInfo.slug === idOrSlug ||
        dashboardInfo.uuid === idOrSlug)
        ? dashboardInfo
        : null,
  );
  const currentDataMask = useSelector<RootState, DataMaskStateWithId>(
    state => state.dataMask,
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
  const [isDashboardHydrated, setDashboardHydrated] = useState<boolean>(false);
  const [isDashboardDatamaskHydrated, setDashboardDatamaskHydrated] =
    useState<boolean>(false);

  const error = dashboardApiError || chartsApiError;
  const readyToHydrate = Boolean(dashboard && charts);
  const { dashboard_title, css, id = 0 } = dashboard || {};

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
    if (readyToHydrate && !isDashboardHydrated) {
      dispatch(
        hydrateDashboard({
          history,
          dashboard,
          charts,
        }),
      );
      setDashboardHydrated(true);
    }
  }, [
    charts,
    dashboard,
    dispatch,
    history,
    isDashboardHydrated,
    readyToHydrate,
  ]);

  /*
   * Decoupled dataMask hydration from the rest of the dashboard.
   * The dataMask is only dependent on dashboardInfo, does not need to wait for charts.
   */
  useEffect(() => {
    const permalinkKey = getUrlParam(URL_PARAMS.permalinkKey);
    const nativeFilterKeyValue = getUrlParam(URL_PARAMS.nativeFiltersKey);
    const isOldRison = getUrlParam(URL_PARAMS.nativeFilters);

    async function getDataMaskApplied() {
      let dataMask = nativeFilterKeyValue || {};
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

      if (activeTabs?.length) {
        dispatch(hydrateDashboardActiveTabs(activeTabs));
      }

      setDashboardDatamaskHydrated(true);
      dispatch(hydrateDashboardDataMask(dataMask, dashboardInfo));
    }
    if (
      id &&
      dashboardInfo &&
      !Object.keys(currentDataMask).length &&
      (permalinkKey || nativeFilterKeyValue || isOldRison) &&
      !isDashboardDatamaskHydrated
    ) {
      getDataMaskApplied();
    }
    if (Object.keys(currentDataMask).length && !isDashboardDatamaskHydrated) {
      setDashboardDatamaskHydrated(true);
    }
  }, [
    dispatch,
    dashboardInfo,
    id,
    history.location,
    isDashboardDatamaskHydrated,
    currentDataMask,
  ]);

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
    if (datasetsApiError) {
      addDangerToast(
        t('Error loading chart datasources. Filters may not work correctly.'),
      );
    } else {
      dispatch(setDatasources(datasets));
    }
  }, [addDangerToast, datasets, datasetsApiError, dispatch]);

  if (error) throw error; // caught in error boundary

  const isLoading = !dashboardInfo;

  const dashboardContext = useMemo(
    () => ({
      hydrated: isDashboardHydrated && isDashboardDatamaskHydrated,
    }),
    [isDashboardDatamaskHydrated, isDashboardHydrated],
  );

  return (
    <>
      <Global
        styles={[
          filterCardPopoverStyle(theme),
          headerStyles(theme),
          chartContextMenuStyles(theme),
          focusStyle(theme),
          chartHeaderStyles(theme),
        ]}
      />
      {!isLoading && <SyncDashboardState dashboardPageId={dashboardPageId} />}
      <DashboardPageIdContext.Provider value={dashboardPageId}>
        <DashboardPageContext.Provider value={dashboardContext}>
          {isLoading ? (
            <Loading />
          ) : (
            <DashboardContainer>
              <DashboardBuilder />
            </DashboardContainer>
          )}
        </DashboardPageContext.Provider>
      </DashboardPageIdContext.Provider>
    </>
  );
};

export default DashboardPage;
