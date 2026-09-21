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
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import type { AnyThemeConfig } from '@apache-superset/core/theme';
import { t } from '@apache-superset/core/translation';
import {
  createMcpWidgetClient,
  getArtifactMcp,
  type ArtifactMcp,
  type McpStrategy,
} from '../mcp/client';
import { SupersetProvider, type ThemeModeName } from './SupersetProvider';

export interface SupersetArtifactProviderProps {
  /** The Superset connector's display name in the viewer's Claude settings. */
  server: string;
  strategy?: McpStrategy;
  proxy?: boolean;
  themeMode?: ThemeModeName;
  themeConfig?: AnyThemeConfig;
  /** Shown while the artifact runtime answers (up to ~10 s). */
  fallback?: ReactNode;
  /** Shown when this view cannot use connectors. */
  renderUnavailable?: (server: string) => ReactNode;
  /** The runtime's `mcp` namespace; resolved from `window.claude` when omitted. */
  mcp?: ArtifactMcp | null;
  children?: ReactNode;
}

type RuntimeState =
  | { status: 'loading' }
  | { status: 'ready'; mcp: ArtifactMcp }
  | { status: 'unavailable' };

const toState = (mcp: ArtifactMcp | null): RuntimeState =>
  mcp ? { status: 'ready', mcp } : { status: 'unavailable' };

/**
 * `SupersetProvider` for a Claude artifact: data comes from the viewer's own
 * Superset connector (their permissions and row-level security), so the page
 * needs no backend, token or network access of its own.
 */
export function SupersetArtifactProvider({
  server,
  strategy,
  proxy,
  themeMode,
  themeConfig,
  fallback = null,
  renderUnavailable,
  mcp,
  children,
}: SupersetArtifactProviderProps) {
  const [state, setState] = useState<RuntimeState>(() =>
    mcp === undefined ? { status: 'loading' } : toState(mcp),
  );

  useEffect(() => {
    if (mcp !== undefined) {
      setState(toState(mcp));
      return undefined;
    }
    let cancelled = false;
    getArtifactMcp().then(resolved => {
      if (!cancelled) setState(toState(resolved));
    });
    return () => {
      cancelled = true;
    };
  }, [mcp]);

  const client = useMemo(
    () =>
      state.status === 'ready'
        ? createMcpWidgetClient({ mcp: state.mcp, server, strategy, proxy })
        : undefined,
    [state, server, strategy, proxy],
  );

  if (state.status === 'loading') return <>{fallback}</>;
  if (!client) {
    return (
      <>
        {renderUnavailable ? (
          renderUnavailable(server)
        ) : (
          <output data-test="superset-artifact-unavailable">
            {t(
              'Superset widgets need to run inside a Claude artifact that can use the %s connector.',
              server,
            )}
          </output>
        )}
      </>
    );
  }

  return (
    <SupersetProvider
      client={client}
      themeMode={themeMode}
      themeConfig={themeConfig}
    >
      {children}
    </SupersetProvider>
  );
}
