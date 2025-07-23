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
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { Theme, AnyThemeConfig, ThemeContextType } from '@superset-ui/core';
import { ThemeMode } from '@superset-ui/core/theme/types';
import { ThemeController } from './ThemeController';

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

  const [currentThemeMode, setCurrentThemeMode] = useState<ThemeMode>(
    themeController.getCurrentMode(),
  );

  useEffect(() => {
    const unsubscribe = themeController.onChange(theme => {
      setCurrentTheme(theme);
      setCurrentThemeMode(themeController.getCurrentMode());
    });

    return unsubscribe;
  }, [themeController]);

  const setTheme = useCallback(
    (config: AnyThemeConfig) => themeController.setTheme(config),
    [themeController],
  );

  const setThemeMode = useCallback(
    (newMode: ThemeMode) => themeController.setThemeMode(newMode),
    [themeController],
  );

  const resetTheme = useCallback(
    () => themeController.resetTheme(),
    [themeController],
  );

  const contextValue = useMemo(
    () => ({
      theme: currentTheme,
      themeMode: currentThemeMode,
      setTheme,
      setThemeMode,
      resetTheme,
    }),
    [currentTheme, currentThemeMode, setTheme, setThemeMode, resetTheme],
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
  const context: ThemeContextType | null = useContext(ThemeContext);

  if (!context)
    throw new Error('useThemeContext must be used within a ThemeProvider');

  return context;
}
