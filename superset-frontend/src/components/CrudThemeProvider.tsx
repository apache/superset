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
import { ReactNode, useContext, useEffect, useMemo } from 'react';
import { logging } from '@apache-superset/core/utils';
import {
  Theme,
  normalizeThemeConfig,
  isThemeConfigDark,
} from '@apache-superset/core/theme';
import getBootstrapData from 'src/utils/getBootstrapData';
import { ThemeContext } from 'src/theme/ThemeProvider';
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
  // An explicit theme config override (e.g. supplied via the Embedded SDK)
  // applies on the global theme controller and must win over the
  // dashboard-level theme. When such an override is active, skip the
  // dashboard theme so the override is not shadowed by this nested provider.
  const themeContext = useContext(ThemeContext);
  const hasThemeConfigOverride = themeContext?.hasThemeConfigOverride ?? false;

  const { dashboardTheme, fontUrls } = useMemo(() => {
    // When an SDK override is active it fully owns theming, so skip parsing the
    // dashboard theme entirely. This also prevents the font-injection effect
    // below from loading dashboard fonts the override does not use.
    if (hasThemeConfigOverride || !theme?.json_data) {
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
  }, [theme?.json_data, hasThemeConfigOverride]);

  useEffect(() => {
    if (hasThemeConfigOverride || !dashboardTheme || !fontUrls?.length) {
      return undefined;
    }

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
  }, [dashboardTheme, fontUrls, hasThemeConfigOverride]);

  if (!dashboardTheme || hasThemeConfigOverride) {
    return <>{children}</>;
  }

  return (
    <dashboardTheme.SupersetThemeProvider>
      {children}
    </dashboardTheme.SupersetThemeProvider>
  );
}
