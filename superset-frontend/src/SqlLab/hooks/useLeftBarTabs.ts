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
import { useViewContainers, type ViewContainer } from 'src/core';
// Side-effect import: registers the built-in Explorer/Settings containers
// before this hook ever reads the registry, regardless of which component
// tree imports this hook first.
import 'src/SqlLab/components/SqlEditorLeftBar/builtins';
import {
  LEFT_SIDEBAR_LOCATION,
  TAB_SETTINGS_ID,
  useManageableLeftBarEntries,
} from './useManageableLeftBarEntries';
import {
  orderViewsBySettings,
  useLeftBarViewSettings,
} from './useLeftBarViewSettings';

export type { ViewContainer as LeftBarTab };
export {
  TAB_EXPLORER_ID,
  TAB_SETTINGS_ID,
} from './useManageableLeftBarEntries';

/**
 * Normalizes the manageable entries (Explorer + registered containers) into
 * the rail's tab list, ordered and filtered per the user's Settings
 * choices, with the built-in Settings container appended — always last,
 * and never itself manageable, so it stays reachable even if every other
 * tab is hidden.
 */
export const useLeftBarTabs = (): ViewContainer[] => {
  const manageable = useManageableLeftBarEntries();
  const settings = useLeftBarViewSettings();
  const containers = useViewContainers(LEFT_SIDEBAR_LOCATION);

  return useMemo(() => {
    if (manageable.length === 0) return [];

    const hiddenIds = new Set(settings.hidden);
    const visible = orderViewsBySettings(manageable, settings.order).filter(
      tab => !hiddenIds.has(tab.id),
    );
    const settingsTab = containers.find(
      container => container.id === TAB_SETTINGS_ID,
    );

    return settingsTab ? [...visible, settingsTab] : visible;
  }, [manageable, settings, containers]);
};
