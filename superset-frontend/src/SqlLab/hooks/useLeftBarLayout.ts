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
 * @fileoverview Persisted selection/collapse state for SQL Lab's left
 * sidebar rail, plus the pure Splitter sizing rule that reconciles the
 * rail's "collapse to icon strip" with the existing "hide the sidebar
 * entirely" mechanism.
 *
 * State is global (not per query editor tab) and persisted to localStorage,
 * mirroring ChatProvider's `{ open, mode }` persistence — a user who opens an
 * extension panel does not expect it to reset when they switch SQL tabs.
 */
import { useCallback, useSyncExternalStore } from 'react';
import {
  LocalStorageKeys,
  getItem,
  setItem,
} from 'src/utils/localStorageHelpers';
import { SQL_EDITOR_LEFTBAR_WIDTH } from 'src/SqlLab/constants';
import {
  TAB_EXPLORER_ID,
  useLeftBarTabs,
  type LeftBarTab,
} from './useLeftBarTabs';

interface LeftBarState {
  activeViewId: string;
  contentCollapsed: boolean;
}

const DEFAULT_STATE: LeftBarState = {
  activeViewId: TAB_EXPLORER_ID,
  contentCollapsed: false,
};

let state: LeftBarState = DEFAULT_STATE;
let hydrated = false;
const listeners = new Set<() => void>();

const getSnapshot = (): LeftBarState => {
  if (!hydrated) {
    hydrated = true;
    const persisted = getItem(
      LocalStorageKeys.SqllabLeftbarState,
      DEFAULT_STATE,
    );
    state = {
      activeViewId: persisted.activeViewId ?? DEFAULT_STATE.activeViewId,
      contentCollapsed: persisted.contentCollapsed === true,
    };
  }
  return state;
};

const setLeftBarState = (next: Partial<LeftBarState>): void => {
  const current = getSnapshot();
  const merged = { ...current, ...next };
  if (
    merged.activeViewId === current.activeViewId &&
    merged.contentCollapsed === current.contentCollapsed
  ) {
    return;
  }
  state = merged;
  setItem(LocalStorageKeys.SqllabLeftbarState, state);
  listeners.forEach(listener => listener());
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/**
 * Test-only helper, mirrors ChatProvider's reset(). Pass a partial override
 * to seed a specific persisted state (e.g. a stale `activeViewId`) without
 * needing to reach into localStorage directly.
 */
export const resetLeftBarLayoutState = (
  override?: Partial<LeftBarState>,
): void => {
  state = { ...DEFAULT_STATE, ...override };
  hydrated = true;
  setItem(LocalStorageKeys.SqllabLeftbarState, state);
  listeners.forEach(listener => listener());
};

export interface LeftPanelLayout {
  size: number;
  min: number;
  resizable: boolean;
}

/**
 * Pure sizing rule for AppLayout's left Splitter.Panel, extracted so it can
 * be unit-tested without a DOM. The rail lives outside the Splitter entirely
 * (see AppLayout), so this only sizes the *content* panel.
 *
 * The Splitter's own collapse chevron (AppLayout passes `collapsible` as a
 * constant, unaffected by this) stays visible in every state — including
 * content-collapsed (rail-driven) — matching the affordance a plain
 * drag-to-hide leaves behind; `resizable` is what actually blocks dragging
 * while rail-collapsed. `min` likewise stays at SQL_EDITOR_LEFTBAR_WIDTH in
 * every state (never 0), since a degenerate min === max would otherwise
 * make that chevron a dead click when the user reaches for it from the
 * collapsed state (see AppLayout's onSidebarChange for how a nonzero report
 * from that chevron gets honored).
 */
export const getLeftPanelLayout = ({
  leftWidth,
  contentCollapsed,
  hasRail,
}: {
  leftWidth: number;
  contentCollapsed: boolean;
  hasRail: boolean;
}): LeftPanelLayout => {
  const collapsedByRail = hasRail && contentCollapsed && leftWidth > 0;
  return {
    size: collapsedByRail ? 0 : leftWidth,
    min: SQL_EDITOR_LEFTBAR_WIDTH,
    resizable: !collapsedByRail,
  };
};

export interface UseLeftBarLayoutResult {
  tabs: LeftBarTab[];
  hasRail: boolean;
  activeViewId: string;
  contentCollapsed: boolean;
  selectView: (id: string) => void;
  toggleContent: () => void;
  expandContent: () => void;
}

export const useLeftBarLayout = (): UseLeftBarLayoutResult => {
  const tabs = useLeftBarTabs();
  const persisted = useSyncExternalStore(
    subscribe,
    getSnapshot,
    () => DEFAULT_STATE,
  );

  const hasRail = tabs.length > 0;
  // Pure derivation (no effect, no write-on-read): a persisted id naming a
  // tab that's since unregistered, or hidden via Settings, falls back to
  // whichever tab now leads the list — usually Explorer, but Explorer can
  // itself be reordered or hidden, so this can't hardcode that id.
  const activeViewId =
    hasRail && tabs.some(tab => tab.id === persisted.activeViewId)
      ? persisted.activeViewId
      : (tabs[0]?.id ?? TAB_EXPLORER_ID);
  // Neutralizes a persisted `contentCollapsed: true` from a session that had
  // widgets registered, so AppLayout never pins the panel at the rail width
  // with nothing in it.
  const contentCollapsed = hasRail && persisted.contentCollapsed;

  const selectView = useCallback(
    (id: string) =>
      setLeftBarState({ activeViewId: id, contentCollapsed: false }),
    [],
  );
  const toggleContent = useCallback(
    () =>
      setLeftBarState({ contentCollapsed: !getSnapshot().contentCollapsed }),
    [],
  );
  const expandContent = useCallback(
    () => setLeftBarState({ contentCollapsed: false }),
    [],
  );

  return {
    tabs,
    hasRail,
    activeViewId,
    contentCollapsed,
    selectView,
    toggleContent,
    expandContent,
  };
};
