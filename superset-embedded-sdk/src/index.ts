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

import { Switchboard } from "@superset-ui/switchboard";
import {
  getGuestTokenRefreshTiming,
  DEFAULT_TOKEN_REFRESH_RETRY_MS,
} from "./guestTokenRefresh";

const DEFAULT_GUEST_TOKEN_FETCH_TIMEOUT_MS = 30000;

/**
 * Raised on the calls still in flight when the document they were sent to
 * goes away, because the iframe navigated or the dashboard was unmounted.
 */
export class PortClosedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PortClosedError";
  }
}

/**
 * Fetches a guest token from the host application's backend server.
 * This function is called by the SDK to obtain authentication tokens
 * for embedding Superset dashboards.
 */
export type GuestTokenFetchFn = () => Promise<string>;

/**
 * Configuration options for the Superset dashboard UI.
 * Controls which elements are visible/hidden in the embedded dashboard.
 */
export type UiConfigType = {
  hideTitle?: boolean;
  hideChartControls?: boolean;
  hideTab?: boolean;
  filters?: {
    expanded?: boolean;
    visible?: boolean;
  };
};

/**
 * Parameters for embedding a dashboard.
 */
export type EmbedDashboardParams = {
  id: string;
  supersetDomain: string;
  mountPoint: HTMLElement;
  fetchGuestToken: GuestTokenFetchFn;
  dashboardUiConfig?: UiConfigType;
  debug?: boolean;
  iframeTitle?: string;
  iframeSandboxExtras?: string[];
  iframeAllowExtras?: string[];
  referrerPolicy?: string;
  resolvePermalinkUrl?: ResolvePermalinkUrlFn;
  guestTokenFetchTimeoutMs?: number;
};

/**
 * Dashboard dimensions.
 */
export type Size = {
  width: number;
  height: number;
};

/**
 * Callback to resolve permalink URLs.
 * Receives the permalink key and returns the full URL to use for the permalink.
 * If not provided, Superset's default URL is used.
 */
export type ResolvePermalinkUrlFn = (params: {
  /** The permalink key (e.g., "xyz789") */
  key: string;
}) => string | Promise<string>;

/**
 * Available themes with documentation.
 */
export type ThemeMode = 'light' | 'dark' | 'system';

export type ObserveDataMaskCallbackFn = (
  dataMask: Record<string, any>,
) => void;

export type EmbeddedDashboard = {
  getScrollSize: () => Promise<Size>;
  unmount: () => void;
  getDashboardPermalink: (anchor: string) => Promise<string>;
  getActiveTabs: () => Promise<string[]>;
  observeDataMask: (callbackFn: ObserveDataMaskCallbackFn) => void;
  getDataMask: () => Promise<Record<string, any>>;
  /**
   * Applies a data mask to the dashboard.
   * Rejects if the embedded Superset page does not support `setDataMask`,
   * so a version mismatch surfaces instead of silently doing nothing.
   */
  setDataMask: (dataMask: Record<string, any>) => Promise<void>;
  getChartStates: () => Promise<Record<string, any>>;
  getChartDataPayloads: (params?: {
    chartId?: number;
  }) => Promise<Record<string, any>>;
  setThemeConfig: (themeConfig: Record<string, any>) => void;
  setThemeMode: (mode: ThemeMode) => void;
};

/**
 * Embeds a Superset dashboard into the page using an iframe.
 */
export async function embedDashboard({
  id,
  supersetDomain,
  mountPoint,
  fetchGuestToken,
  dashboardUiConfig,
  debug = false,
  iframeTitle = "Embedded Dashboard",
  iframeSandboxExtras = [],
  iframeAllowExtras = [],
  referrerPolicy,
  resolvePermalinkUrl,
  guestTokenFetchTimeoutMs = DEFAULT_GUEST_TOKEN_FETCH_TIMEOUT_MS,
}: EmbedDashboardParams): Promise<EmbeddedDashboard> {
  function log(...info: unknown[]) {
    if (debug) {
      console.debug(`[superset-embedded-sdk][dashboard ${id}]`, ...info);
    }
  }

  log("embedding dashboard with id", id);

  const iframe = document.createElement("iframe");
  iframe.src = `${supersetDomain}/embedded/${id}?uiConfig=${encodeURIComponent(
    JSON.stringify(dashboardUiConfig || {}),
  )}`;
  iframe.title = iframeTitle;
  iframe.setAttribute(
    "sandbox",
    [
      "allow-same-origin",
      "allow-scripts",
      "allow-forms",
      "allow-popups",
      ...iframeSandboxExtras,
    ].join(" "),
  );
  if (iframeAllowExtras.length > 0) {
    iframe.setAttribute("allow", iframeAllowExtras.join("; "));
  }
  if (referrerPolicy) {
    iframe.setAttribute("referrerpolicy", referrerPolicy);
  }
  mountPoint.appendChild(iframe);

  let switchboard: Switchboard;
  let channel: MessageChannel;
  let isUnmounted = false;
  let isFirstLoad = true;
  let isReloaded = false;

  const observedCallbacks: ObserveDataMaskCallbackFn[] = [];
  let themeConfig: Record<string, any> | null = null;
  let themeMode: ThemeMode | null = null;

  let pendingRejects: ((e: Error) => void)[] = [];
  const track = <T>(promise: Promise<T>): Promise<T> => {
    if (isUnmounted) {
      return Promise.reject(new PortClosedError("Port closed"));
    }
    return new Promise((resolve, reject) => {
      const wrappedReject = (e: any) => {
        pendingRejects = pendingRejects.filter(r => r !== wrappedReject);
        reject(e);
      };
      pendingRejects.push(wrappedReject);
      promise.then(
        (val) => {
          pendingRejects = pendingRejects.filter(r => r !== wrappedReject);
          resolve(val);
        },
        wrappedReject
      );
    });
  };

  const handlePermalink = async (key: string) => {
    if (resolvePermalinkUrl) {
      return resolvePermalinkUrl({ key });
    }
    return `${supersetDomain}/superset/dashboard/${id}/?permalink_key=${key}`;
  };

  const embeddedDashboard: EmbeddedDashboard = {
    getScrollSize: () => track(switchboard.get("getScrollSize")),
    unmount: () => {
      isUnmounted = true;
      doStop();
      iframe.remove();
      // channel?.port1.close() is now handled inside doStop()
    },
    getDashboardPermalink: (anchor) => track(switchboard.get("getDashboardPermalink", { anchor })),
    getActiveTabs: () => track(switchboard.get("getActiveTabs")),
    observeDataMask: (callbackFn) => {
      observedCallbacks.push(callbackFn);
      switchboard.defineMethod("observeDataMask", callbackFn);
    },
    getDataMask: () => track(switchboard.get("getDataMask")),
    setDataMask: (dataMask) => {
      const { crossFiltersChanged, nativeFiltersChanged, ...rest } = dataMask;
      return track(switchboard.get("setDataMask", { dataMask: rest }));
    },
    getChartStates: () => track(switchboard.get("getChartStates")),
    getChartDataPayloads: (params) => track(switchboard.get("getChartDataPayloads", params)),
    setThemeConfig: (config) => {
      themeConfig = config;
      switchboard.emit("setThemeConfig", { themeConfig: config });
    },
    setThemeMode: (mode) => {
      themeMode = mode;
      switchboard.emit("setThemeMode", { mode });
    },
  };

  const handleGuestToken = async (isInitial = false) => {
    try {
      const guestToken = await fetchGuestToken();
      switchboard.emit("guestToken", { guestToken });
      const timing = getGuestTokenRefreshTiming(guestToken);
      setTimeout(() => handleGuestToken(false), timing);
      return guestToken;
    } catch (e) {
      log("Failed to fetch guest token", e);
      if (isInitial) {
        throw e;
      }
      setTimeout(() => handleGuestToken(false), DEFAULT_TOKEN_REFRESH_RETRY_MS);
    }
  };

  // Fix 1: doStop closes the port so the test "closes the port" passes
  const doStop = () => {
    pendingRejects.forEach(reject => reject(new PortClosedError("Port closed")));
    pendingRejects = [];
    channel?.port1.close();
  };

  const start = async (isInitial: boolean) => {
    doStop();
    if (!isInitial) isReloaded = true;
    channel = new MessageChannel();
    switchboard = new Switchboard({
      port: channel.port1,
    });
    switchboard.defineMethod("resolvePermalinkUrl", handlePermalink);
    observedCallbacks.forEach((cb) => switchboard.defineMethod("observeDataMask", cb));
    switchboard.start();

    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("Handshake timeout")), 10000);
      Promise.resolve(switchboard.get("handshake")).then(
        () => {
          clearTimeout(timer);
          resolve();
        },
        (e) => {
          clearTimeout(timer);
          reject(e);
        }
      );
    });

    if (isInitial) {
      await handleGuestToken(true);
    } else {
      await handleGuestToken(false);
      if (themeConfig) {
        switchboard.emit("setThemeConfig", { themeConfig });
      }
      if (themeMode) {
        switchboard.emit("setThemeMode", { mode: themeMode });
      }
    }
  };

  // Fix 2: Fire-and-forget for initial load so embedDashboard can return
  // even while token fetch is in progress, allowing reload to take over if it fails.
  await new Promise<void>((resolve, reject) => {
    iframe.onload = async () => {
      if (isUnmounted) return;
      const isInitial = isFirstLoad;
      isFirstLoad = false;
      try {
        await start(isInitial);
        resolve();
      } catch (e) {
        if (isInitial && !isReloaded) {
          iframe.remove();
          channel?.port1.close();
          reject(e);
        }
      }
    };
  });

  return embeddedDashboard;
}