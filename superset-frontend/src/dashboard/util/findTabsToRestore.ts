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
import type { DashboardLayout, DashboardState } from 'src/dashboard/types';

interface FindTabsToRestoreResult {
  activeTabs: string[];
  inactiveTabs: string[];
}

/**
 * Computes the active/inactive tab sets when navigating to `tabId`: restores
 * previously-inactive descendant tabs and deactivates the prior tab's siblings.
 */
export function findTabsToRestore(
  tabId: string,
  prevTabId: string | undefined,
  dashboardState: Pick<DashboardState, 'activeTabs' | 'inactiveTabs'>,
  currentLayout: DashboardLayout,
): FindTabsToRestoreResult {
  const { activeTabs: prevActiveTabs, inactiveTabs: prevInactiveTabs } =
    dashboardState;
  const restoredTabs: string[] = [];
  const queue: string[] = [tabId];
  const visited = new Set<string>();
  while (queue.length > 0) {
    const seek = queue.shift()!;
    if (!visited.has(seek)) {
      visited.add(seek);
      const found =
        prevInactiveTabs?.filter(inactiveTabId =>
          (currentLayout[inactiveTabId]?.parents ?? [])
            .filter((parentId: string) => parentId.startsWith('TAB-'))
            .slice(-1)
            .includes(seek),
        ) ?? [];
      restoredTabs.push(...found);
      queue.push(...found);
    }
  }
  const activeTabs =
    restoredTabs.length > 0 ? [tabId].concat(restoredTabs) : [tabId];
  const tabChanged = Boolean(prevTabId) && tabId !== prevTabId;
  const inactiveTabs = tabChanged
    ? (prevActiveTabs || []).filter(
        (activeTabId: string) =>
          activeTabId !== prevTabId &&
          (currentLayout[activeTabId]?.parents ?? []).includes(prevTabId!),
      )
    : [];
  return {
    activeTabs,
    inactiveTabs,
  };
}
