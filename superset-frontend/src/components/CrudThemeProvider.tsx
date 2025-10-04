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
import { ReactNode, useEffect, useState } from 'react';
import { useThemeContext } from 'src/theme/ThemeProvider';
import { Theme } from '@superset-ui/core';
import { Loading } from '@superset-ui/core/components';

interface CrudThemeProviderProps {
  children: ReactNode;
  themeId?: number | null;
}

/**
 * CrudThemeProvider asks the ThemeController for a dashboard theme provider.
 * Flow: Dashboard loads → asks controller → controller fetches theme →
 * returns provider → dashboard uses it.
 *
 * CRITICAL: This does NOT modify the global controller - it creates an isolated dashboard theme.
 */
export default function CrudThemeProvider({
  children,
  themeId,
}: CrudThemeProviderProps) {
  const globalThemeContext = useThemeContext();
  const [dashboardTheme, setDashboardTheme] = useState<Theme | null>(null);

  useEffect(() => {
    if (themeId) {
      // Ask the controller to create a SEPARATE dashboard theme provider
      // This should NOT affect the global controller or navbar
      const loadDashboardTheme = async () => {
        try {
          const dashboardThemeProvider =
            await globalThemeContext.createDashboardThemeProvider(
              String(themeId),
            );
          setDashboardTheme(dashboardThemeProvider);
        } catch (error) {
          console.error('Failed to load dashboard theme:', error);
          setDashboardTheme(null);
        }
      };

      loadDashboardTheme();
    } else {
      setDashboardTheme(null);
    }
  }, [themeId, globalThemeContext]);

  // If no themeId, just render children (they use global theme)
  if (!themeId) {
    return <>{children}</>;
  }

  // If themeId exists, but theme is not loaded yet, return null to prevent re-mounting children
  if (!dashboardTheme) {
    return <Loading />;
  }

  // Render children with the dashboard theme provider from controller
  return (
    <dashboardTheme.SupersetThemeProvider>
      {children}
    </dashboardTheme.SupersetThemeProvider>
  );
}
