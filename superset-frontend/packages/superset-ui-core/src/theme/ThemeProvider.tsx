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

import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Theme } from './Theme';
import { AnyThemeConfig } from './types';
import { ThemeController } from './ThemeController';

interface ThemeContextType {
  theme: Theme;
  setTheme: (config: AnyThemeConfig) => void;
  toggleDarkMode: (isDark: boolean) => void;
  resetTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | null>(null);

interface ThemeProviderProps {
  children: React.ReactNode;
  themeController: ThemeController;
}

export function SupersetThemeProvider({
  children,
  themeController,
}: ThemeProviderProps): JSX.Element {
  const [currentTheme, setCurrentTheme] = useState<Theme>(
    themeController.getTheme(),
  );

  useEffect(() => {
    const unsubscribe = themeController.onChange(theme => {
      setCurrentTheme(theme);
    });

    return unsubscribe;
  }, [themeController]);

  const contextValue = useMemo(
    () => ({
      theme: currentTheme,
      setTheme: (config: AnyThemeConfig) => themeController.setTheme(config),
      toggleDarkMode: (isDark: boolean) =>
        themeController.toggleDarkMode(isDark),
      resetTheme: () => themeController.resetTheme(),
    }),
    [currentTheme, themeController],
  );

  return (
    <ThemeContext.Provider value={contextValue}>
      <currentTheme.SupersetThemeProvider>
        {children}
      </currentTheme.SupersetThemeProvider>
    </ThemeContext.Provider>
  );
}

/**
 * React hook to use the theme context
 */
export function useThemeContext(): ThemeContextType {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useThemeContext must be used within a ThemeProvider');
  }
  return context;
}
