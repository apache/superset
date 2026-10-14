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

import type { StateCreator } from 'zustand';
import type { DashboardStateStore } from '../types';

export interface NavigationSlice {
  activeTabs: string[];
  inactiveTabs: string[];
  directPathToChild: string[];
  directPathLastUpdated: number;
  nativeFiltersBarOpen: boolean;
  tabActivationTimes: Record<string, number>;
  setActiveTabs: (activeTabs: string[]) => void;
  setInactiveTabs: (inactiveTabs: string[]) => void;
  setDirectPathToChild: (path: string[]) => void;
  setNativeFiltersBarOpen: (isOpen: boolean) => void;
  updateTabActivationTimes: (tabIds: string[]) => void;
  /**
   * activeTabs/inactiveTabs are deltas (from findTabsToRestore) merged into
   * the sets, so sibling tab groups are preserved rather than replaced.
   */
  applyActiveTab: (
    activeTabs: string[],
    inactiveTabs: string[],
    prevTabId?: string,
  ) => void;
}

export const navigationInitialState = {
  activeTabs: [] as string[],
  inactiveTabs: [] as string[],
  directPathToChild: [] as string[],
  directPathLastUpdated: 0,
  // Upstream defaulted via `?? false`; useNativeFilters opens the bar on mount
  // when the dashboard has filters.
  nativeFiltersBarOpen: false,
  tabActivationTimes: {} as Record<string, number>,
};

export const createNavigationSlice: StateCreator<
  DashboardStateStore,
  [['zustand/devtools', never], ['zustand/subscribeWithSelector', never]],
  [],
  NavigationSlice
> = set => ({
  ...navigationInitialState,

  setActiveTabs: (activeTabs: string[]) =>
    set({ activeTabs }, false, 'dashboardState/setActiveTabs'),

  setInactiveTabs: (inactiveTabs: string[]) =>
    set({ inactiveTabs }, false, 'dashboardState/setInactiveTabs'),

  setDirectPathToChild: (directPathToChild: string[]) =>
    set(
      { directPathToChild, directPathLastUpdated: Date.now() },
      false,
      'dashboardState/setDirectPathToChild',
    ),

  setNativeFiltersBarOpen: (nativeFiltersBarOpen: boolean) =>
    set(
      { nativeFiltersBarOpen },
      false,
      'dashboardState/setNativeFiltersBarOpen',
    ),

  updateTabActivationTimes: (tabIds: string[]) =>
    set(
      state => {
        const now = Date.now();
        const tabActivationTimes = { ...state.tabActivationTimes };
        tabIds.forEach(tabId => {
          tabActivationTimes[tabId] = now;
        });
        return { tabActivationTimes };
      },
      false,
      'dashboardState/updateTabActivationTimes',
    ),

  applyActiveTab: (activeTabs, inactiveTabs, prevTabId) =>
    set(
      state => {
        const toRemoveFromActive = new Set([
          ...inactiveTabs,
          ...(prevTabId ? [prevTabId] : []),
        ]);
        const nextActive = new Set(
          state.activeTabs.filter(tab => !toRemoveFromActive.has(tab)),
        );
        activeTabs.forEach(tab => nextActive.add(tab));

        const activeTabsSet = new Set(activeTabs);
        const nextInactive = new Set(
          state.inactiveTabs.filter(tab => !activeTabsSet.has(tab)),
        );
        inactiveTabs.forEach(tab => nextInactive.add(tab));

        const now = Date.now();
        const tabActivationTimes = { ...state.tabActivationTimes };
        activeTabs.forEach(tab => {
          tabActivationTimes[tab] = now;
        });

        return {
          activeTabs: Array.from(nextActive),
          inactiveTabs: Array.from(nextInactive),
          tabActivationTimes,
        };
      },
      false,
      'dashboardState/applyActiveTab',
    ),
});
