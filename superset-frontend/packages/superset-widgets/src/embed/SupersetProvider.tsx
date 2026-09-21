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
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  Theme,
  ThemeAlgorithm,
  type AnyThemeConfig,
} from '@apache-superset/core/theme';
import { setupAGGridModules } from '@superset-ui/core/components/ThemedAgGridReact';
import { WidgetBusContext, createWidgetBus } from '../bus';
import { WidgetDataClientContext } from '../dataClient';
import type { WidgetBus, WidgetDataClient } from '../types';
import {
  ExtensionWidgetLoaderContext,
  createExtensionWidgetLoader,
  type ExtensionWidgetLoader,
} from './extensionLoader';
import { createGuestTokenSource } from './guestToken';
import { createHttpWidgetClient } from './httpClient';

export type ThemeModeName = 'default' | 'dark' | 'system';

export interface SupersetProviderProps {
  /** Origin of the Superset deployment, e.g. `https://superset.example.com`. */
  supersetDomain?: string;
  /**
   * A ready data client (e.g. the MCP client inside a Claude artifact); when
   * given, `supersetDomain` and the token options are not used.
   */
  client?: WidgetDataClient;
  /** A bus shared with other providers or React roots, so their widgets cross-filter. */
  bus?: WidgetBus;
  /**
   * Fetches a guest token from the host's own backend. Omit to use the
   * browser's Superset session (same-site deployments only).
   */
  fetchGuestToken?: () => Promise<string>;
  guestTokenHeaderName?: string;
  guestTokenFetchTimeoutMs?: number;
  /**
   * Widget types contributed by Superset extensions, loaded from
   * `supersetDomain` the first time one is rendered. `false` turns that off;
   * a loader of your own replaces it.
   */
  extensionWidgets?: boolean | ExtensionWidgetLoader;
  themeMode?: ThemeModeName;
  themeConfig?: AnyThemeConfig;
  children?: ReactNode;
}

const DARK_QUERY = '(prefers-color-scheme: dark)';

function useDarkMode(mode: ThemeModeName): boolean {
  const [systemDark, setSystemDark] = useState(
    () =>
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia(DARK_QUERY).matches,
  );
  useEffect(() => {
    if (mode !== 'system' || typeof window.matchMedia !== 'function') {
      return undefined;
    }
    const query = window.matchMedia(DARK_QUERY);
    const onChange = (event: MediaQueryListEvent) =>
      setSystemDark(event.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, [mode]);
  return mode === 'dark' || (mode === 'system' && systemDark);
}

let agGridReady = false;

/**
 * Everything widgets under it share: one event bus (so they cross-filter),
 * one authenticated data client, and the Superset theme. Nothing leaks into
 * the host page's global styles.
 */
export function SupersetProvider({
  supersetDomain,
  client: providedClient,
  bus: providedBus,
  fetchGuestToken,
  guestTokenHeaderName,
  guestTokenFetchTimeoutMs,
  extensionWidgets = true,
  themeMode = 'default',
  themeConfig,
  children,
}: SupersetProviderProps) {
  if (!agGridReady) {
    setupAGGridModules();
    agGridReady = true;
  }

  const fetchRef = useRef(fetchGuestToken);
  fetchRef.current = fetchGuestToken;
  const usesGuestToken = fetchGuestToken !== undefined;

  const ownBus = useMemo(createWidgetBus, []);
  const bus = providedBus ?? ownBus;
  // One token source for everything this provider fetches from Superset: the
  // data client and, when an extension's widget turns up, its bundle.
  const getGuestToken = useMemo(() => {
    if (!usesGuestToken) return undefined;
    const tokens = createGuestTokenSource(() => {
      const fetchToken = fetchRef.current;
      return fetchToken
        ? fetchToken()
        : Promise.reject(new Error('fetchGuestToken was removed'));
    }, guestTokenFetchTimeoutMs);
    return () => tokens.get();
  }, [usesGuestToken, guestTokenFetchTimeoutMs]);

  const client = useMemo(() => {
    if (providedClient) return providedClient;
    if (!supersetDomain) {
      throw new Error(
        'SupersetProvider needs either supersetDomain or client.',
      );
    }
    return createHttpWidgetClient({
      supersetDomain,
      guestTokenHeaderName,
      getGuestToken,
    });
  }, [providedClient, supersetDomain, guestTokenHeaderName, getGuestToken]);

  const extensionLoader = useMemo(() => {
    if (typeof extensionWidgets === 'function') return extensionWidgets;
    if (!extensionWidgets || !supersetDomain) return undefined;
    return createExtensionWidgetLoader({
      supersetDomain,
      guestTokenHeaderName,
      getGuestToken,
    });
  }, [extensionWidgets, supersetDomain, guestTokenHeaderName, getGuestToken]);

  const dark = useDarkMode(themeMode);
  const theme = useMemo(
    () =>
      Theme.fromConfig({
        ...themeConfig,
        algorithm: dark ? ThemeAlgorithm.DARK : ThemeAlgorithm.DEFAULT,
      } as AnyThemeConfig),
    [themeConfig, dark],
  );
  const { SupersetThemeProvider } = theme;

  return (
    <SupersetThemeProvider withGlobalStyles={false}>
      <WidgetBusContext.Provider value={bus}>
        <WidgetDataClientContext.Provider value={client}>
          <ExtensionWidgetLoaderContext.Provider value={extensionLoader}>
            {children}
          </ExtensionWidgetLoaderContext.Provider>
        </WidgetDataClientContext.Provider>
      </WidgetBusContext.Provider>
    </SupersetThemeProvider>
  );
}
