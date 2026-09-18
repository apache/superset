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

/**
 * @fileoverview Ids for the left sidebar's two built-in view containers,
 * plus the "manageable" set derived from the generic container registry.
 *
 * Kept dependency-free (below `builtins.tsx` and `LeftBarViewSettingsPanel`
 * in the module graph) so both can depend on it without a cycle: `builtins`
 * registers the containers these ids name, and the Settings panel lists
 * the manageable set this module derives from the same registry.
 */
import { useMemo } from 'react';
import { useViewContainers, type ViewContainer } from 'src/core';
import { ViewLocations } from 'src/SqlLab/contributions';

export const TAB_EXPLORER_ID = 'sqllab.tabExplorer';
export const TAB_SETTINGS_ID = 'sqllab.leftBarSettings';

export const LEFT_SIDEBAR_LOCATION = ViewLocations.sqllab.leftSidebar;

/**
 * The built-in Explorer plus every registered extension container — the
 * full set of items a user can reorder and show/hide in the Settings
 * panel. Excludes the built-in Settings container itself (always pinned
 * last, never manageable — see `useLeftBarTabs`). Returns an empty array
 * when nothing beyond the two built-ins is registered, so the rail can stay
 * hidden entirely and the plain Explorer render with no rail chrome.
 */
export const useManageableLeftBarEntries = (): ViewContainer[] => {
  const containers = useViewContainers(LEFT_SIDEBAR_LOCATION);

  return useMemo(() => {
    const entries = containers.filter(
      container => container.id !== TAB_SETTINGS_ID,
    );
    const hasExtras = entries.some(
      container => container.id !== TAB_EXPLORER_ID,
    );
    return hasExtras ? entries : [];
  }, [containers]);
};
