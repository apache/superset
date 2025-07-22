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
import { ReactNode, useMemo, useEffect } from 'react';
import { ThemeController } from 'src/theme/ThemeController';

interface CrudThemeProviderProps {
  children: ReactNode;
  themeId?: number | null;
}

/**
 * CrudThemeProvider creates a scoped theme context using ThemeController.
 * This ensures that CRUD themes are properly integrated with the existing
 * theme system while providing isolated theme contexts where needed.
 */
export default function CrudThemeProvider({
  children,
  themeId,
}: CrudThemeProviderProps) {
  const themeController = useMemo(() => new ThemeController(), []);
  const theme = themeController.getTheme();

  useEffect(() => {
    if (themeId) {
      themeController.setCrudTheme(String(themeId));
    } else {
      themeController.setCrudTheme(null);
    }
  }, [themeId, themeController]);

  // If no theme is specified, render children without theme wrapper
  if (!themeId) {
    return <>{children}</>;
  }

  // Render children within the CRUD theme context
  return <theme.SupersetThemeProvider>{children}</theme.SupersetThemeProvider>;
}
