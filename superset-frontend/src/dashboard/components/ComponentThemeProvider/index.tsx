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
import { type ReactNode, useContext, useEffect, useState } from 'react';
import type { Theme } from '@apache-superset/core/theme';
import { ThemeContext } from 'src/theme/ThemeProvider';
import { useEffectiveThemeId } from './useEffectiveThemeId';

interface ComponentThemeProviderProps {
  /**
   * Layout item id (the key into `dashboardLayout.present`). The provider
   * walks up the parents tree from this node to compute the effective
   * theme override.
   */
  layoutId: string | undefined;
  children: ReactNode;
}

/**
 * Per-component theme override wrapper. When the component (or any
 * ancestor up to but not including the dashboard root) sets a `themeId`
 * in its `LayoutItemMeta`, this provider loads that CRUD theme and
 * applies it as a `SupersetThemeProvider` around the children, overriding
 * the dashboard-level (and, transitively, the instance-level) theme for
 * this subtree.
 *
 * When no ancestor sets a `themeId` — the default — the component renders
 * as a pass-through. The outer `CrudThemeProvider` (mounted by
 * `DashboardPage`) continues to provide the dashboard-level theme.
 */
export default function ComponentThemeProvider({
  layoutId,
  children,
}: ComponentThemeProviderProps) {
  const effectiveThemeId = useEffectiveThemeId(layoutId);
  // Read ThemeContext directly (not via `useThemeContext`, which throws
  // when no ThemeProvider is mounted). When rendered outside a dashboard
  // — e.g. isolated component tests, storybook, embedded contexts that
  // skip the dashboard ThemeProvider — we behave as a pass-through.
  const themeContext = useContext(ThemeContext);
  const [componentTheme, setComponentTheme] = useState<Theme | null>(null);

  useEffect(() => {
    if (effectiveThemeId == null || !themeContext) {
      setComponentTheme(null);
      return undefined;
    }
    let cancelled = false;
    // `createDashboardThemeProvider` caches by id internally, so per-component
    // calls for the same theme are deduplicated to a single fetch.
    themeContext
      .createDashboardThemeProvider(String(effectiveThemeId))
      .then(theme => {
        if (!cancelled) setComponentTheme(theme);
      });
    return () => {
      cancelled = true;
    };
  }, [effectiveThemeId, themeContext]);

  if (!componentTheme) {
    return <>{children}</>;
  }

  return (
    <componentTheme.SupersetThemeProvider>
      {children}
    </componentTheme.SupersetThemeProvider>
  );
}

export {
  useEffectiveThemeId,
  pickEffectiveThemeId,
} from './useEffectiveThemeId';
