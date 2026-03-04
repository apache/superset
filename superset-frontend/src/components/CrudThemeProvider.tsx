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
import { ReactNode, useMemo } from 'react';
import { logging } from '@apache-superset/core';
import { Theme } from '@apache-superset/core/ui';
import type { Dashboard } from 'src/types/Dashboard';

interface CrudThemeProviderProps {
  children: ReactNode;
  theme?: Dashboard['theme'];
}

/**
 * CrudThemeProvider applies a dashboard-specific theme using theme data
 * from the dashboard API response. Falls back to the global theme if
 * the theme data is missing or invalid.
 */
export default function CrudThemeProvider({
  children,
  theme,
}: CrudThemeProviderProps) {
  const dashboardTheme = useMemo(() => {
    if (!theme?.json_data) {
      return null;
    }
    try {
      const themeConfig = JSON.parse(theme.json_data);
      return Theme.fromConfig(themeConfig);
    } catch (error) {
      logging.warn('Failed to load dashboard theme:', error);
      return null;
    }
  }, [theme?.json_data]);

  if (!dashboardTheme) {
    return <>{children}</>;
  }

  return (
    <dashboardTheme.SupersetThemeProvider>
      {children}
    </dashboardTheme.SupersetThemeProvider>
  );
}
