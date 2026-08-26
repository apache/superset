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
import { useMemo } from 'react';
import { t } from '@apache-superset/core/translation';
import { useLeftBarViews } from 'src/core';
import {
  orderViewsBySettings,
  useLeftBarViewSettings,
} from './useLeftBarViewSettings';

export const TAB_EXPLORER_ID = 'sqllab.tabExplorer';
export const TAB_SETTINGS_ID = 'sqllab.leftBarSettings';

export interface LeftBarTab {
  id: string;
  name: string;
  description?: string;
}

/**
 * The built-in Explorer plus every registered extension view — the full set
 * of items a user can reorder and show/hide in the Settings panel. Returns
 * an empty array when no extension is registered at all, so the container
 * can render the bare table explorer with no rail chrome — Explorer alone
 * isn't manageable; it only joins the manageable set once there's something
 * else registered alongside it.
 */
export const useManageableLeftBarEntries = (): LeftBarTab[] => {
  const views = useLeftBarViews();

  return useMemo(() => {
    if (views.length === 0) return [];
    return [{ id: TAB_EXPLORER_ID, name: t('Explorer') }, ...views];
  }, [views]);
};

/**
 * Normalizes the manageable entries (Explorer + registered views) into the
 * rail's tab list, ordered and filtered per the user's Settings choices, with
 * the built-in Settings tab appended — always last, and never itself
 * manageable, so it stays reachable even if every other tab is hidden.
 */
export const useLeftBarTabs = (): LeftBarTab[] => {
  const manageable = useManageableLeftBarEntries();
  const settings = useLeftBarViewSettings();

  return useMemo(() => {
    if (manageable.length === 0) return [];

    const hiddenIds = new Set(settings.hidden);
    const visible = orderViewsBySettings(manageable, settings.order).filter(
      tab => !hiddenIds.has(tab.id),
    );

    return [...visible, { id: TAB_SETTINGS_ID, name: t('Settings') }];
  }, [manageable, settings]);
};
