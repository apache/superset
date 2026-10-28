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
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { debounce } from 'lodash-es';
import type { UserWithPermissionsAndRoles } from 'src/types/bootstrapTypes';
import { DASHBOARD_WORKSPACE_SIDEBAR_DEFAULT_WIDTH } from './constants';
import {
  clampSidebarWidth,
  defaultSidebarPrefs,
  loadSidebarPrefs,
  orderKeysFromDashboards,
  reconcileDashboardOrder,
  saveSidebarPrefs,
  sidebarPrefsUserKey,
  type SidebarPrefs,
} from './sidebarPrefs';
import type { WorkspaceDashboard } from './utils';

const WIDTH_SAVE_DEBOUNCE_MS = 400;

export function useDashboardWorkspaceSidebarPrefs(
  user: UserWithPermissionsAndRoles | undefined,
  dashboards: WorkspaceDashboard[],
  prefsEnabled: boolean,
) {
  const userKey = sidebarPrefsUserKey(user);
  const [prefs, setPrefsState] = useState<SidebarPrefs>(defaultSidebarPrefs);
  const prefsRef = useRef(prefs);
  prefsRef.current = prefs;

  useEffect(() => {
    if (!prefsEnabled) {
      setPrefsState(defaultSidebarPrefs());
      return undefined;
    }
    let cancelled = false;
    loadSidebarPrefs(userKey).then(result => {
      if (!cancelled) {
        setPrefsState(result.prefs);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [userKey, prefsEnabled]);

  const flushWidthSave = useMemo(
    () =>
      debounce((next: SidebarPrefs) => {
        saveSidebarPrefs(userKey, next);
      }, WIDTH_SAVE_DEBOUNCE_MS),
    [userKey],
  );

  useEffect(
    () => () => {
      flushWidthSave.cancel();
    },
    [flushWidthSave],
  );

  const persistImmediate = useCallback(
    (next: SidebarPrefs) => {
      setPrefsState(next);
      if (prefsEnabled) {
        flushWidthSave.cancel();
        saveSidebarPrefs(userKey, next);
      }
    },
    [flushWidthSave, prefsEnabled, userKey],
  );

  const persistWidth = useCallback(
    (next: SidebarPrefs) => {
      setPrefsState(next);
      if (prefsEnabled) {
        flushWidthSave(next);
      }
    },
    [flushWidthSave, prefsEnabled],
  );

  const sortedDashboards = useMemo(() => {
    if (!prefsEnabled) {
      return dashboards;
    }
    return reconcileDashboardOrder(dashboards, prefs.order);
  }, [dashboards, prefs.order, prefsEnabled]);

  const setOrderFromDashboards = useCallback(
    (ordered: WorkspaceDashboard[]) => {
      persistImmediate({
        ...prefsRef.current,
        order: orderKeysFromDashboards(ordered),
      });
    },
    [persistImmediate],
  );

  const setWidth = useCallback(
    (width: number) => {
      persistWidth({
        ...prefsRef.current,
        width: clampSidebarWidth(width),
      });
    },
    [persistWidth],
  );

  const setCollapsed = useCallback(
    (collapsed: boolean) => {
      persistImmediate({ ...prefsRef.current, collapsed });
    },
    [persistImmediate],
  );

  const resetWidth = useCallback(() => {
    persistImmediate({
      ...prefsRef.current,
      width: DASHBOARD_WORKSPACE_SIDEBAR_DEFAULT_WIDTH,
    });
  }, [persistImmediate]);

  return {
    sortedDashboards,
    sidebarWidth: prefs.width,
    sidebarCollapsed: prefs.collapsed,
    setOrderFromDashboards,
    setWidth,
    setCollapsed,
    resetWidth,
  };
}
