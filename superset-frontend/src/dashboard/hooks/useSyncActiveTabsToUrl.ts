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
import { useEffect, useRef } from 'react';
import { matchPath, useHistory } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { URL_PARAMS } from 'src/constants';
import { RoutePaths } from 'src/views/routePaths';
import { TAB_TYPE } from 'src/dashboard/util/componentTypes';
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
  const layout = useSelector(
    (state: RootState) => state.dashboardLayout?.present ?? {},
  );
  const editMode = useSelector(
    (state: RootState) => state.dashboardState.editMode,
  );

  const reconciledHash = useRef<string>();

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

    // `navigateWithState` updates the address bar without the router, so after
    // an in-session save the router can hold a stale location (e.g. an old
    // slug). In that case the address bar is the source of truth and is
    // written directly, so the navigation is neither undone nor left unsynced.
    // The router decodes its pathname, so compare against the decoded address
    // bar to keep non-ASCII slugs from reading as a divergence.
    let addressBarPath = window.location.pathname;
    try {
      addressBarPath = decodeURI(addressBarPath);
    } catch {
      // malformed escapes: compare the raw path
    }
    const diverged =
      addressBarPath !==
      history.createHref({ pathname: history.location.pathname });
    const location = diverged ? window.location : history.location;

    // A deep link hash outranks `active_tabs` on load, so it is dropped once
    // the selected tabs no longer include a tab the hash targets. The tabs are
    // resolved from the layout, as a tab click replaces `directPathToChild`.
    // Only a hash that was first reconciled with the selected tabs can go
    // stale, so the initial hydration, where `Tabs` has yet to switch to the
    // hash's tab, never clears it.
    const hashId = location.hash.slice(1);
    const hashTabsActive = [...(layout[hashId]?.parents ?? []), hashId].every(
      id => layout[id]?.type !== TAB_TYPE || activeTabs?.includes(id),
    );
    if (hashId && hashTabsActive) {
      reconciledHash.current = hashId;
    }
    const hashIsStale =
      Boolean(hashId) && reconciledHash.current === hashId && !hashTabsActive;

    const params = new URLSearchParams(location.search);
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
    const search = params.toString();
    const hash = hashIsStale ? '' : location.hash;
    if (diverged) {
      window.history.replaceState(
        window.history.state,
        '',
        `${window.location.pathname}${search ? `?${search}` : ''}${hash}`,
      );
    } else {
      history.replace({ ...history.location, search, hash });
    }
  }, [activeTabs, editMode, enabled, history, layout]);
}
