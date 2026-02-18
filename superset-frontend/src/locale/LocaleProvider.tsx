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
import { LocaleController } from './LocaleController';

/**
 * Locale context value provided to consumers.
 */
export interface LocaleContextType {
  /** Current locale code (e.g., 'en', 'ru', 'de') */
  locale: string;
  /** Whether a locale change is in progress */
  isLoading: boolean;
  /** Whether the locale controller has been initialized */
  isReady: boolean;
  /** Change the application locale */
  setLocale: (locale: string) => Promise<void>;
  /** Translate a string using the current locale */
  t: (key: string, ...args: unknown[]) => string;
  /** Translate a string with pluralization */
  tn: (key: string, ...args: unknown[]) => string;
}

const LocaleContext = createContext<LocaleContextType | null>(null);

interface LocaleProviderProps {
  children: React.ReactNode;
  controller: LocaleController;
}

/**
 * LocaleProvider integrates LocaleController with React.
 *
 * This provider follows the same pattern as SupersetThemeProvider:
 * - Subscribes to controller changes via useEffect
 * - Triggers re-renders when locale changes
 * - Provides context for child components
 *
 * Usage:
 * ```tsx
 * const controller = new LocaleController({ initialLocale: 'en' });
 *
 * function App() {
 *   return (
 *     <LocaleProvider controller={controller}>
 *       <MyComponent />
 *     </LocaleProvider>
 *   );
 * }
 *
 * function MyComponent() {
 *   const { locale, setLocale, t } = useLocaleContext();
 *   return <div>{t('Hello')}</div>;
 * }
 * ```
 */
export function LocaleProvider({
  children,
  controller,
}: LocaleProviderProps): JSX.Element {
  const [locale, setLocaleState] = useState<string>(controller.getLocale());
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isReady, setIsReady] = useState<boolean>(controller.isReady());

  // Subscribe to controller changes
  useEffect(() => {
    const unsubscribe = controller.onChange(newLocale => {
      setLocaleState(newLocale);
      setIsLoading(false);
      setIsReady(controller.isReady());
    });

    // Update isReady state periodically until controller is initialized
    // This handles the case where controller is initializing asynchronously
    if (!controller.isReady()) {
      const checkReady = setInterval(() => {
        if (controller.isReady()) {
          setIsReady(true);
          clearInterval(checkReady);
        }
      }, 50);

      return () => {
        unsubscribe();
        clearInterval(checkReady);
      };
    }

    return unsubscribe;
  }, [controller]);

  const setLocale = useCallback(
    async (newLocale: string): Promise<void> => {
      setIsLoading(true);
      try {
        await controller.setLocale(newLocale);
      } finally {
        setIsLoading(false);
      }
    },
    [controller],
  );

  const t = useCallback(
    (key: string, ...args: unknown[]): string => controller.t(key, ...args),
    [controller],
  );

  const tn = useCallback(
    (key: string, ...args: unknown[]): string => controller.tn(key, ...args),
    [controller],
  );

  const contextValue = useMemo<LocaleContextType>(
    () => ({
      locale,
      isLoading,
      isReady,
      setLocale,
      t,
      tn,
    }),
    [locale, isLoading, isReady, setLocale, t, tn],
  );

  return (
    <LocaleContext.Provider value={contextValue}>
      {children}
    </LocaleContext.Provider>
  );
}

/**
 * React hook to access the locale context.
 *
 * @throws Error if used outside of LocaleProvider
 */
export function useLocaleContext(): LocaleContextType {
  const context = useContext(LocaleContext);

  if (!context) {
    throw new Error('useLocaleContext must be used within a LocaleProvider');
  }

  return context;
}

/**
 * React hook to access just the current locale.
 * Lighter alternative to useLocaleContext when you only need the locale value.
 */
export function useCurrentLocale(): string {
  const { locale } = useLocaleContext();
  return locale;
}
