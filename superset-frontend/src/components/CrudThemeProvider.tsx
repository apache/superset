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
import { ReactNode, useEffect, useMemo } from 'react';
import { logging, Theme, isThemeConfigDark } from '@superset-ui/core';
import { normalizeThemeConfig } from '@superset-ui/core/theme/utils';
import getBootstrapData from 'src/utils/getBootstrapData';
import type { Dashboard } from 'src/types/Dashboard';

interface CrudThemeProviderProps {
  children: ReactNode;
  theme?: Dashboard['theme'];
}

/**
 * CrudThemeProvider applies a dashboard-specific theme using theme data
 * from the dashboard API response. Merges with the system's base theme
 * (light or dark) and loads custom fonts. Falls back to the global theme
 * if the theme data is missing or invalid.
 */
export default function CrudThemeProvider({
  children,
  theme,
}: CrudThemeProviderProps) {
  const { dashboardTheme, fontUrls } = useMemo(() => {
    if (!theme?.json_data) {
      return { dashboardTheme: null, fontUrls: undefined };
    }
    try {
      const themeConfig = JSON.parse(theme.json_data);
      const normalizedConfig = normalizeThemeConfig(themeConfig);
      const isDark = isThemeConfigDark(normalizedConfig);
      const {
        common: { theme: bootstrapTheme },
      } = getBootstrapData();
      const baseTheme = isDark ? bootstrapTheme.dark : bootstrapTheme.default;
      const createdTheme = Theme.fromConfig(
        normalizedConfig,
        baseTheme || undefined,
      );
      const rawUrls = themeConfig?.token?.fontUrls;
      const urls = Array.isArray(rawUrls) ? (rawUrls as string[]) : undefined;
      return { dashboardTheme: createdTheme, fontUrls: urls };
    } catch (error) {
      logging.warn('Failed to load dashboard theme:', error);
      return { dashboardTheme: null, fontUrls: undefined };
    }
  }, [theme?.json_data]);

  useEffect(() => {
    if (!dashboardTheme || !fontUrls?.length) return undefined;

    // JSON.stringify provides safe escaping to prevent CSS injection
    const css = fontUrls
      .map((url: string) => `@import url(${JSON.stringify(url)});`)
      .join('\n');
    const style = document.createElement('style');
    style.setAttribute('data-superset-fonts', 'true');
    style.textContent = css;
    document.head.appendChild(style);

    return () => {
      style.remove();
    };
  }, [dashboardTheme, fontUrls]);

  if (!dashboardTheme) {
    return <>{children}</>;
  }

  return (
    <dashboardTheme.SupersetThemeProvider>
      {children}
    </dashboardTheme.SupersetThemeProvider>
  );
}
