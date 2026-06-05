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
import { useSyncExternalStore } from 'react';
import { useSelector } from 'react-redux';
import type {
  DashboardLayout,
  LayoutItem,
  RootState,
} from 'src/dashboard/types';
import { DASHBOARD_ROOT_ID } from 'src/dashboard/util/constants';
import { previewThemeStore } from './previewThemeStore';

/**
 * Walks up the dashboard layout tree from `layoutId` and returns the first
 * `themeId` it finds, or `null` if no ancestor sets one.
 *
 * Inheritance order (closest wins):
 *   Chart/Markdown -> Row/Column -> Tab -> Dashboard root -> (null = inherit
 *   from dashboard CRUD theme or instance theme, applied by CrudThemeProvider
 *   higher in the tree).
 *
 * `themeId: null` on a node means "explicitly clear my override" — we treat
 * the property as absent (and continue walking) iff it is undefined; a literal
 * `null` is also treated as "no override" since the dashboard-level theme is
 * applied by a different provider.
 */
export function pickEffectiveThemeId(
  layoutId: string | undefined,
  layout: DashboardLayout,
): number | null {
  if (!layoutId || !layout) return null;
  let cursorId: string | undefined = layoutId;
  // Defensive cap — dashboards shouldn't nest deeper than this, and the cap
  // protects against malformed `parents` arrays causing infinite loops.
  let hops = 0;
  while (cursorId && cursorId !== DASHBOARD_ROOT_ID && hops < 32) {
    const node: LayoutItem | undefined = layout[cursorId];
    if (!node) return null;
    const themeId = node.meta?.themeId;
    if (typeof themeId === 'number') return themeId;
    cursorId = node.parents?.[node.parents.length - 1];
    hops += 1;
  }
  return null;
}

/**
 * Redux hook variant of `pickEffectiveThemeId`. Memoizes on the layout
 * reference; consumers that only care about the resolved id (not the layout
 * map itself) won't re-render when sibling components change their meta.
 *
 * If `ThemeSelectorModal` has registered a preview override for this
 * `layoutId` via `previewThemeStore`, the preview wins — that's how the
 * modal applies a draft selection visually without committing to Redux.
 */
export function useEffectiveThemeId(
  layoutId: string | undefined,
): number | null {
  const reduxResolved = useSelector<RootState, number | null>(state =>
    pickEffectiveThemeId(layoutId, state.dashboardLayout?.present),
  );
  const preview = useSyncExternalStore(
    previewThemeStore.subscribe,
    () =>
      layoutId === undefined ? undefined : previewThemeStore.get(layoutId),
    () => undefined,
  );
  return preview === undefined ? reduxResolved : preview;
}
