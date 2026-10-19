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
import { matchPath, useHistory } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { URL_PARAMS } from 'src/constants';
import { RoutePaths } from 'src/views/routePaths';
import type { RootState } from 'src/dashboard/types';

const TAB_ID_SEPARATOR = ',';

/**
 * Parses the `active_tabs` URL param into a list of tab ids.
 */
export function parseActiveTabsParam(value: string | null): string[] {
  return (value ?? '')
    .split(TAB_ID_SEPARATOR)
    .map(tabId => tabId.trim())
    .filter(Boolean);
}

/**
 * Keeps the `active_tabs` URL param in line with the dashboard's active tabs,
 * so that a link to the dashboard opens on the same tabs. Follows the redux
 * state rather than tab clicks so that tabs restored from a permalink or from
 * the URL itself are reflected as well.
 *
 * @param enabled Whether the dashboard has been hydrated
 */
export default function useSyncActiveTabsToUrl(enabled: boolean): void {
  const history = useHistory();
  const activeTabs = useSelector(
    (state: RootState) => state.dashboardState.activeTabs,
  );
  const editMode = useSelector(
    (state: RootState) => state.dashboardState.editMode,
  );

  useEffect(() => {
    // The pathname check avoids racing with navigation to Explore
    if (
      !enabled ||
      editMode ||
      matchPath(history.location.pathname, {
        path: [RoutePaths.DASHBOARD_LIST, RoutePaths.DASHBOARD],
        exact: true,
      })?.path !== RoutePaths.DASHBOARD
    ) {
      return;
    }

    const params = new URLSearchParams(history.location.search);
    const current = params.get(URL_PARAMS.activeTabs.name);
    const next = activeTabs?.length ? [...activeTabs].sort().join(',') : null;
    const currentNormalized = current
      ? parseActiveTabsParam(current).sort().join(',')
      : null;
    if (currentNormalized === next) {
      return;
    }

    if (next) {
      params.set(URL_PARAMS.activeTabs.name, next);
    } else {
      params.delete(URL_PARAMS.activeTabs.name);
    }
    history.replace({ ...history.location, search: params.toString() });
  }, [activeTabs, editMode, enabled, history]);
}
