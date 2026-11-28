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
import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { SupersetClient } from '@superset-ui/core';
import { logging } from '@apache-superset/core/utils';
import { useUiConfig } from 'src/components/UiConfigContext';
import { dashboardInfoChanged } from 'src/dashboard/actions/dashboardInfo';
import type { RootState } from 'src/dashboard/types';
import type { DashboardFreshness } from './types';

/**
 * Whether the "Data as of" label should show: the deployment enables
 * `DATA_FRESHNESS_ENABLED`, the dashboard opts in with `show_data_freshness`,
 * and (when embedded) the host app opts in with `showDataFreshness`.
 */
export const useShowDataFreshness = (): boolean => {
  const { showDataFreshness } = useUiConfig();
  const enabled = useSelector<RootState, boolean>(state =>
    Boolean(state.dashboardInfo?.common?.conf?.DATA_FRESHNESS_ENABLED),
  );
  const dashboardOptIn = useSelector<RootState, boolean>(state =>
    Boolean(state.dashboardInfo?.metadata?.show_data_freshness),
  );
  return enabled && dashboardOptIn && showDataFreshness;
};

/** The loaded freshness of the current dashboard, if any. */
export const useDataFreshness = (): DashboardFreshness | undefined =>
  useSelector<RootState, DashboardFreshness | undefined>(
    state => state.dashboardInfo?.dataFreshness,
  );

/** The time zone freshness timestamps are displayed in, if configured. */
export const useDataFreshnessTimezone = (): string | undefined =>
  useSelector<RootState, string | undefined>(
    state =>
      (state.dashboardInfo?.common?.conf?.DATA_FRESHNESS_DISPLAY_TIMEZONE as
        | string
        | null
        | undefined) ?? undefined,
  );

/**
 * Load the dashboard's freshness into the store whenever the label should
 * show. Errors leave the label hidden rather than surfacing a toast: freshness
 * is supplementary information.
 */
export const useDataFreshnessLoader = (dashboardId: number | undefined) => {
  const dispatch = useDispatch();
  const show = useShowDataFreshness();

  useEffect(() => {
    if (!show || !dashboardId) {
      return undefined;
    }
    let cancelled = false;
    SupersetClient.get({
      endpoint: `/api/v1/dashboard/${dashboardId}/freshness`,
    })
      .then(({ json }) => {
        if (!cancelled) {
          dispatch(dashboardInfoChanged({ dataFreshness: json.result }));
        }
      })
      .catch(error => {
        logging.warn('Could not load dashboard data freshness', error);
        if (!cancelled) {
          dispatch(dashboardInfoChanged({ dataFreshness: undefined }));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [dashboardId, dispatch, show]);
};
