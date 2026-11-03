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
  DASHBOARD_UI_FILTER_CONFIG_URL_PARAM_KEY,
  IFRAME_COMMS_MESSAGE_TYPE,
} from "./const";

import { Switchboard } from "@superset-ui/switchboard";
import {
  getGuestTokenRefreshTiming,
  DEFAULT_TOKEN_REFRESH_RETRY_MS,
} from "./guestTokenRefresh";
import { withTimeout } from "./withTimeout";

export type GuestTokenFetchFn = () => Promise<string>;

export type UiConfigType = {
  hideTitle?: boolean;
  hideTab?: boolean;
  hideChartControls?: boolean;
  emitDataMasks?: boolean;
  filters?: {
    [key: string]: boolean | undefined;
    visible?: boolean;
    expanded?: boolean;
  };
  urlParams?: {
    [key: string]: any;
  };
  showRowLimitWarning?: boolean;
};

const DEFAULT_GUEST_TOKEN_FETCH_TIMEOUT_MS = 30_000;
const HANDSHAKE_PROBE_METHOD = "supersetEmbeddedSdkHandshake";
const HANDSHAKE_PROBE_TIMEOUT_MS = 5_000;

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
  referrerPolicy?: ReferrerPolicy;
  resolvePermalinkUrl?: ResolvePermalinkUrlFn;
  guestTokenFetchTimeoutMs?: number;
};

export type Size = {
  width: number;
  height: number;
};

export type ObserveDataMaskCallbackFn = (
  dataMask: Record<string, any> & {
    crossFiltersChanged: boolean;
    nativeFiltersChanged: boolean;
  },
) => void;

export type ThemeMode = "default" | "dark" | "system";

export class PortClosedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PortClosedError";
  }
}

type HostMethod = (args: never) => unknown;

type Connection = {
  switchboard: Switchboard;
  port: MessagePort;
  pending: Set<(err: Error) => void>;
  tokenSent: boolean;
  closed: boolean;
};

export type ResolvePermalinkUrlFn = (params: {
  key: string;
}) => string | Promise<string>;

export type EmbeddedDashboard = {
  getScrollSize: () => Promise<Size>;
  unmount: () => void;
  getDashboardPermalink: (anchor: string) => Promise<string>;
  getActiveTabs: () => Promise<string[]>;
  observeDataMask: (callbackFn: ObserveDataMaskCallbackFn) => void;
  getDataMask: () => Promise<Record<string, any>>;
  setDataMask: (dataMask: Record<string, any>) => Promise<void>;
  getChartStates: () => Promise<Record<string, any>>;
  getChartDataPayloads: (params?: { chartId?: number }) => Promise<Record<string, any>>;
  setThemeConfig: (themeConfig: Record<string, any>) => void;
  setThemeMode: (mode: ThemeMode) => void;
};

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

  function fetchGuestTokenWithTimeout(): Promise<string> {
    return withTimeout(fetchGuestToken(), guestTokenFetchTimeoutMs, "fetchGuestToken");
  }

  log("embedding");

  if (supersetDomain.endsWith("/")) {
    supersetDomain = supersetDomain.slice(0, -1);
  }

  function calculateConfig() {
    let configNumber = 0;
    if (dashboardUiConfig) {
      if (dashboardUiConfig.hideTitle) configNumber += 1;
      if (dashboardUiConfig.hideTab) configNumber += 2;
      if (dashboardUiConfig.hideChartControls) configNumber += 8;
      if (dashboardUiConfig.emitDataMasks) configNumber += 16;
      if (dashboardUiConfig.showRowLimitWarning) configNumber += 32;
    }
    return configNumber;
  }

  let connection!: Connection;
  let refreshTimer: ReturnType<typeof setTimeout> | undefined;
  let unmounted = false;
  let generation = 0;
  const hostMethods: Record<string, HostMethod> = {};
  const hostState = new Map<string, unknown>();

  function connect(iframe: HTMLIFrameElement): Connection {
    const commsChannel = new MessageChannel();
    iframe.contentWindow!.postMessage(
      { type: IFRAME_COMMS_MESSAGE_TYPE, handshake: "port transfer" },
      supersetDomain,
      [commsChannel.port2],
    );
    log("sent message channel to the iframe");

    const switchboard = new Switchboard({
      port: commsChannel.port1,
      name: "superset-embedded-sdk",
      debug,
    });
    switchboard.start();
    Object.entries(hostMethods).forEach(([name, fn]) => {
      switchboard.defineMethod(name, fn);
    });
    return {
      switchboard,
      port: commsChannel.port1,
      pending: new Set(),
      tokenSent: false,
      closed: false,
    };
  }

  function closeConnection(conn: Connection | undefined, reason: string) {
    if (!conn || conn.closed) return;
    conn.closed = true;
    const pending = Array.from(conn.pending);
    conn.pending.clear();
    pending.forEach((reject) => reject(new PortClosedError(reason)));
    conn.port.close?.();
  }

  function teardown(reason: string) {
    unmounted = true;
    if (refreshTimer !== undefined) {
      clearTimeout(refreshTimer);
      refreshTimer = undefined;
    }
    closeConnection(connection, reason);
    // @ts-ignore
    mountPoint.replaceChildren();
  }

  function defineHostMethod<A extends object>(name: string, fn: (args: A) => unknown) {
    hostMethods[name] = fn;
    connection.switchboard.defineMethod(name, fn);
  }

  function emitHostState(method: string, args: unknown) {
    hostState.set(method, args);
    connection.switchboard.emit(method, args);
  }

  function portGet<T>(method: string, args?: unknown): Promise<T> {
    const conn = connection;
    if (conn.closed) {
      return Promise.reject(new PortClosedError(`"${method}" was called on a closed port`));
    }
    return new Promise<T>((resolve, reject) => {
      conn.pending.add(reject);
      Promise.resolve(conn.switchboard.get<T>(method, args))
        .then(resolve, reject)
        .finally(() => conn.pending.delete(reject));
    });
  }

  function armRefresh(delayMs: number) {
    if (refreshTimer !== undefined) clearTimeout(refreshTimer);
    refreshTimer = setTimeout(refreshGuestToken, delayMs);
  }

  async function mountIframe(): Promise<void> {
    return new Promise((resolve) => {
      const iframe = document.createElement("iframe");
      const dashboardConfigUrlParams = dashboardUiConfig ? { uiConfig: `${calculateConfig()}` } : undefined;
      const filterConfig = dashboardUiConfig?.filters || {};
      const filterConfigKeys = Object.keys(filterConfig);
      const filterConfigUrlParams = Object.fromEntries(
        filterConfigKeys.map((key) => [DASHBOARD_UI_FILTER_CONFIG_URL_PARAM_KEY[key], filterConfig[key]])
      );

      const urlParams = { ...dashboardConfigUrlParams, ...filterConfigUrlParams, ...dashboardUiConfig?.urlParams };
      const urlParamsString = Object.keys(urlParams).length ? "?" + new URLSearchParams(urlParams).toString() : "";

      iframe.sandbox.add("allow-same-origin");
      iframe.sandbox.add("allow-scripts");
      iframe.sandbox.add("allow-presentation");
      iframe.sandbox.add("allow-downloads");
      iframe.sandbox.add("allow-forms");
      iframe.sandbox.add("allow-popups");
      iframeSandboxExtras.forEach((key: string) => { iframe.sandbox.add(key); });
      if (referrerPolicy) { iframe.referrerPolicy = referrerPolicy; }

      let firstLoad = true;
      iframe.addEventListener("load", () => {
        if (unmounted || !iframe.contentWindow) return;
        closeConnection(connection, "the embedded page navigated away");
        connection = connect(iframe);
        if (firstLoad) {
          firstLoad = false;
          resolve();
          return;
        }
        log("iframe reloaded, re-authenticating on the new port");
        if (refreshTimer !== undefined) {
          clearTimeout(refreshTimer);
          refreshTimer = undefined;
        }
        void reauthenticate(connection);
      });
      iframe.src = `${supersetDomain}/embedded/${id}${urlParamsString}`;
      iframe.title = iframeTitle;
      iframe.style.background = "transparent";
      const allowFeatures = Array.from(new Set(["fullscreen", "clipboard-write", ...iframeAllowExtras]));
      iframe.setAttribute("allow", allowFeatures.join("; "));
      // @ts-ignore
      mountPoint.replaceChildren(iframe);
      log("placed the iframe");
    });
  }

  let guestToken: string | undefined;
  try {
    [guestToken] = await Promise.all([fetchGuestTokenWithTimeout(), mountIframe()]);
  } catch (err) {
    if (generation === 0) {
      teardown("the initial guest token fetch failed");
      throw err;
    }
    log("the initial guest token fetch failed, a reload has taken over:", err);
  }

  if (guestToken !== undefined) {
    deliverGuestToken(0, guestToken);
  }

  function deliverGuestToken(gen: number, token: string) {
    if (unmounted) return;
    const ownsChain = gen === generation;
    if (ownsChain || !connection.tokenSent) {
      const firstTokenForDocument = !connection.tokenSent;
      connection.tokenSent = true;
      connection.switchboard.emit("guestToken", { guestToken: token });
      log("sent guest token");
      if (firstTokenForDocument) {
        hostState.forEach((args, method) => {
          connection.switchboard.emit(method, args);
        });
      }
    }
    if (ownsChain) {
      armRefresh(getGuestTokenRefreshTiming(token));
    }
  }

  async function reauthenticate(conn: Connection) {
    if (!(await handshakeAcknowledged(conn))) {
      log("nothing answered the handshake, not fetching a guest token");
      return;
    }
    if (unmounted || conn !== connection) return;
    await refreshGuestToken();
  }

  async function handshakeAcknowledged(conn: Connection): Promise<boolean> {
    try {
      await withTimeout(
        Promise.resolve(conn.switchboard.get(HANDSHAKE_PROBE_METHOD)).catch(() => undefined),
        HANDSHAKE_PROBE_TIMEOUT_MS,
        "embedded page handshake"
      );
      return true;
    } catch {
      return false;
    }
  }

  async function refreshGuestToken() {
    if (unmounted) return;
    const gen = ++generation;
    try {
      const newGuestToken = await fetchGuestTokenWithTimeout();
      if (unmounted) return;
      deliverGuestToken(gen, newGuestToken);
    } catch (err) {
      log("failed to refresh guest token, will retry:", err);
      if (unmounted || gen !== generation) return;
      armRefresh(DEFAULT_TOKEN_REFRESH_RETRY_MS);
    }
  }

  defineHostMethod("resolvePermalinkUrl", async ({ key }: { key: string }): Promise<string | null> => {
    if (!resolvePermalinkUrl) return null;
    try {
      return await resolvePermalinkUrl({ key });
    } catch (error) {
      log("Error in resolvePermalinkUrl callback:", error);
      return null;
    }
  });

  function unmount() {
    log("unmounting");
    teardown("the dashboard was unmounted");
  }

  const getScrollSize = () => portGet<Size>("getScrollSize");
  const getDashboardPermalink = (anchor: string) => portGet<string>("getDashboardPermalink", { anchor });
  const getActiveTabs = () => portGet<string[]>("getActiveTabs");
  const getDataMask = () => portGet<Record<string, any>>("getDataMask");
  const setDataMask = (dataMask: Record<string, any>) =>
    portGet<void>("setDataMask", {
      dataMask: Object.fromEntries(
        Object.entries(dataMask).filter(([, mask]) => typeof mask === "object" && mask !== null)
      ),
    });
  const getChartStates = () => portGet<Record<string, any>>("getChartStates");
  const getChartDataPayloads = (params?: { chartId?: number }) => portGet<Record<string, any>>("getChartDataPayloads", params);
  const observeDataMask = (callbackFn: ObserveDataMaskCallbackFn) => {
    defineHostMethod("observeDataMask", callbackFn);
  };
  const setThemeConfig = async (themeConfig: Record<string, any>): Promise<void> => {
    try {
      emitHostState("setThemeConfig", { themeConfig });
      log("Theme config sent successfully");
    } catch (error) {
      log('Error sending theme config.');
      throw error;
    }
  };
  const setThemeMode = (mode: ThemeMode): void => {
    try {
      emitHostState("setThemeMode", { mode });
      log(`Theme mode set to: ${mode}`);
    } catch (error) {
      log('Error sending theme mode.');
      throw error;
    }
  };

  return {
    getScrollSize,
    unmount,
    getDashboardPermalink,
    getActiveTabs,
    observeDataMask,
    getDataMask,
    setDataMask,
    getChartStates,
    getChartDataPayloads,
    setThemeConfig,
    setThemeMode,
  };
}