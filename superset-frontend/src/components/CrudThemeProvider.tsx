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
import {
  ReactNode,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
} from 'react';
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
 * Applies a dashboard-specific theme from the dashboard API response, merged
 * over the system's base theme (light or dark), and loads custom fonts. Falls
 * back to the global theme when the theme data is missing or invalid.
 *
 * A single, stable Theme instance is updated in place instead of recreated, so
 * the SupersetThemeProvider identity stays constant and the dashboard subtree
 * is not remounted when the applied theme changes.
 */
export default function CrudThemeProvider({
  children,
  theme,
}: CrudThemeProviderProps) {
  const themeContext = useContext(ThemeContext);
  const hasThemeConfigOverride = themeContext?.hasThemeConfigOverride ?? false;

  const parsedTheme = useMemo(() => {
    if (hasThemeConfigOverride || !theme?.json_data) {
      return null;
    }
    try {
      const themeConfig = JSON.parse(theme.json_data);
      const normalizedConfig = normalizeThemeConfig(themeConfig);
      const isDark = isThemeConfigDark(normalizedConfig);
      const {
        common: { theme: bootstrapTheme },
      } = getBootstrapData();
      const baseTheme = isDark ? bootstrapTheme.dark : bootstrapTheme.default;
      const rawUrls = themeConfig?.token?.fontUrls;
      const fontUrls = Array.isArray(rawUrls)
        ? (rawUrls as string[])
        : undefined;
      return { normalizedConfig, baseTheme: baseTheme || undefined, fontUrls };
    } catch (error) {
      logging.warn('Failed to load dashboard theme:', error);
      return null;
    }
  }, [theme?.json_data, hasThemeConfigOverride]);

  // Create the stable instance once; update it in place on later changes.
  const dashboardThemeRef = useRef<Theme | null>(null);
  if (parsedTheme && !dashboardThemeRef.current) {
    try {
      dashboardThemeRef.current = Theme.fromConfig(
        parsedTheme.normalizedConfig,
        parsedTheme.baseTheme,
      );
    } catch (error) {
      logging.warn('Failed to load dashboard theme:', error);
    }
  }

  useLayoutEffect(() => {
    if (parsedTheme && dashboardThemeRef.current) {
      try {
        dashboardThemeRef.current.setConfig(
          parsedTheme.normalizedConfig,
          parsedTheme.baseTheme,
        );
      } catch (error) {
        logging.warn('Failed to load dashboard theme:', error);
      }
    }
  }, [parsedTheme]);

  useEffect(() => {
    if (
      !parsedTheme ||
      !dashboardThemeRef.current ||
      !parsedTheme.fontUrls?.length
    ) {
      return undefined;
    }
    // JSON.stringify escapes the URL to prevent CSS injection.
    const css = parsedTheme.fontUrls
      .map((url: string) => `@import url(${JSON.stringify(url)});`)
      .join('\n');
    const style = document.createElement('style');
    style.setAttribute('data-superset-fonts', 'true');
    style.textContent = css;
    document.head.appendChild(style);

    return () => {
      style.remove();
    };
  }, [parsedTheme]);

  if (!parsedTheme || !dashboardThemeRef.current) {
    return <>{children}</>;
  }

  const DashboardThemeProvider =
    dashboardThemeRef.current.SupersetThemeProvider;
  return <DashboardThemeProvider>{children}</DashboardThemeProvider>;
}
