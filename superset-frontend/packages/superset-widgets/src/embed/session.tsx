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
import type { CSSProperties } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { dashboard as dashboardApi } from '@apache-superset/core';
import type { AnyThemeConfig } from '@apache-superset/core/theme';
import { HOST_SOURCE_PREFIX } from '@apache-superset/core/widgets';
import { createWidgetBus } from '../bus';
import {
  createMcpWidgetClient,
  getArtifactMcp,
  type ArtifactMcp,
  type McpStrategy,
} from '../mcp/client';
import type { HostFilter, WidgetDataClient, WidgetEvent } from '../types';
import { hostFilterPayload } from './hooks';
import type { ExtensionWidgetLoader } from './extensionLoader';
import { SupersetProvider, type ThemeModeName } from './SupersetProvider';
import { Widget } from './Widget';

export interface WidgetSessionOptions {
  /** The Superset connector's display name in the viewer's Claude settings. */
  server?: string;
  strategy?: McpStrategy;
  /** Call through the connector's `call_tool` meta-tool. */
  proxy?: boolean;
  themeMode?: ThemeModeName;
  themeConfig?: AnyThemeConfig;
  /** The artifact runtime's `mcp` namespace; resolved from `window.claude` when omitted. */
  mcp?: ArtifactMcp | null | Promise<ArtifactMcp | null>;
  /** Any other data client (e.g. `createHttpWidgetClient`), used instead of MCP. */
  client?: WidgetDataClient;
  /**
   * Loads widget types contributed by Superset extensions (see
   * `createExtensionWidgetLoader`). A session has no Superset origin of its
   * own, so without one an extension's widget cannot be drawn.
   */
  extensionWidgets?: ExtensionWidgetLoader;
  /**
   * Adds the Google Fonts stylesheet for Inter and IBM Plex Mono. The bundle
   * ships no font files, and Google Fonts is the one stylesheet host
   * artifacts allow. Defaults to `true`.
   */
  loadFonts?: boolean;
}

export type MountTarget =
  { type: string; props?: Record<string, unknown> } | { id: string };

export interface MountOptions {
  /** Identity on the bus, used by filter `targets`; generated when omitted. */
  instanceId?: string;
  className?: string;
  style?: CSSProperties;
  showTitle?: boolean;
}

export interface MountedWidget {
  instanceId: string;
  unmount(): void;
}

export interface WidgetSession {
  /** Renders one widget into `element`, which the session then owns. */
  mount(
    element: Element,
    target: MountTarget,
    options?: MountOptions,
  ): MountedWidget;
  /** A host-owned filter under `key`; `null` clears it. */
  setFilter(key: string, filter: HostFilter | null): void;
  /** Subscribes to widget (and host) events, e.g. `valueChanged`. */
  on(eventType: string, listener: (event: WidgetEvent) => void): () => void;
  setThemeMode(mode: ThemeModeName): void;
  /** Unmounts every widget and clears the session's host filters. */
  dispose(): void;
}

const FONTS_LINK_ID = 'superset-widgets-fonts';
const FONTS_URL =
  'https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=Inter:wght@200;400;500;600&display=swap';

function ensureFonts(): void {
  if (typeof document === 'undefined') return;
  if (document.getElementById(FONTS_LINK_ID)) return;
  const link = document.createElement('link');
  link.id = FONTS_LINK_ID;
  link.rel = 'stylesheet';
  link.href = FONTS_URL;
  document.head.appendChild(link);
}

let generatedIds = 0;

/**
 * Widgets for hosts that do not render them through React context, such as a
 * plain HTML page or a Claude React artifact that ships its own React. Every
 * mount is a separate React root of the bundled React, but all of a
 * session's widgets share one event bus and one data client, so they
 * cross-filter like widgets under one `SupersetProvider`.
 */
export function createSession(options: WidgetSessionOptions): WidgetSession {
  const {
    server,
    strategy,
    proxy,
    themeConfig,
    extensionWidgets,
    loadFonts = true,
  } = options;
  let themeMode: ThemeModeName = options.themeMode ?? 'default';

  let client: WidgetDataClient;
  if (options.client) {
    ({ client } = options);
  } else if (server) {
    client = createMcpWidgetClient({
      mcp: options.mcp !== undefined ? options.mcp : getArtifactMcp(),
      server,
      strategy,
      proxy,
    });
  } else {
    throw new Error(
      'createSession needs the Superset connector name (`server`) or a `client`.',
    );
  }

  const bus = createWidgetBus();
  const mounts = new Map<string, { root: Root; render: () => void }>();
  const hostFilterKeys = new Set<string>();
  let disposed = false;

  if (loadFonts) ensureFonts();

  const emitHostFilter = (key: string, filter: HostFilter | null) =>
    bus.emit(
      `${HOST_SOURCE_PREFIX}${key}`,
      dashboardApi.VALUE_CHANGED_EVENT,
      hostFilterPayload(filter),
    );

  return {
    mount(element, target, mountOptions = {}) {
      if (disposed) {
        throw new Error('This widget session has been disposed.');
      }
      generatedIds += 1;
      const instanceId = mountOptions.instanceId ?? `widget-${generatedIds}`;
      if (mounts.has(instanceId)) {
        throw new Error(
          `A widget with instanceId "${instanceId}" is already mounted.`,
        );
      }

      const root = createRoot(element);
      const common = {
        instanceId,
        className: mountOptions.className,
        style: mountOptions.style,
        showTitle: mountOptions.showTitle,
      };
      const render = () =>
        root.render(
          <SupersetProvider
            client={client}
            bus={bus}
            themeMode={themeMode}
            themeConfig={themeConfig}
            extensionWidgets={extensionWidgets ?? false}
          >
            {'id' in target ? (
              <Widget id={target.id} {...common} />
            ) : (
              <Widget
                type={target.type}
                props={target.props ?? {}}
                {...common}
              />
            )}
          </SupersetProvider>,
        );
      render();
      mounts.set(instanceId, { root, render });

      return {
        instanceId,
        unmount() {
          const mounted = mounts.get(instanceId);
          if (!mounted) return;
          mounts.delete(instanceId);
          mounted.root.unmount();
        },
      };
    },

    setFilter(key, filter) {
      if (disposed) return;
      if (filter) hostFilterKeys.add(key);
      else hostFilterKeys.delete(key);
      emitHostFilter(key, filter);
    },

    on(eventType, listener) {
      const subscription = bus.on(eventType, listener);
      return () => subscription.dispose();
    },

    setThemeMode(mode) {
      if (disposed || mode === themeMode) return;
      themeMode = mode;
      mounts.forEach(mounted => mounted.render());
    },

    dispose() {
      if (disposed) return;
      disposed = true;
      mounts.forEach(mounted => mounted.root.unmount());
      mounts.clear();
      hostFilterKeys.forEach(key => emitHostFilter(key, null));
      hostFilterKeys.clear();
    },
  };
}
