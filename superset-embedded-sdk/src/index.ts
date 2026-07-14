/*
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

// We can swap this out for the actual switchboard package once it gets published
import { Switchboard } from "@superset-ui/switchboard";
import {
  getGuestTokenRefreshTiming,
  DEFAULT_TOKEN_REFRESH_RETRY_MS,
} from "./guestTokenRefresh";
import { withTimeout } from "./withTimeout";

/**
 * The function to fetch a guest token from your Host App's backend server.
 * The Host App backend must supply an API endpoint
 * which returns a guest token with appropriate resource access.
 */
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

/** Default per-call timeout (ms) applied to the host `fetchGuestToken` callback. */
const DEFAULT_GUEST_TOKEN_FETCH_TIMEOUT_MS = 30_000;

export type EmbedDashboardParams = {
  /** The id provided by the embed configuration UI in Superset */
  id: string;
  /** The domain where Superset can be located, with protocol, such as: https://superset.example.com */
  supersetDomain: string;
  /** The html element within which to mount the iframe */
  mountPoint: HTMLElement;
  /** A function to fetch a guest token from the Host App's backend server */
  fetchGuestToken: GuestTokenFetchFn;
  /** The dashboard UI config: hideTitle, hideTab, hideChartControls, filters.visible, filters.expanded **/
  dashboardUiConfig?: UiConfigType;
  /** Are we in debug mode? */
  debug?: boolean;
  /** The iframe title attribute */
  iframeTitle?: string;
  /** additional iframe sandbox attributes ex (allow-top-navigation, allow-popups-to-escape-sandbox) **/
  iframeSandboxExtras?: string[];
  /** Additional Permissions Policy features for the iframe's `allow` attribute (e.g., ['camera', 'microphone']). `fullscreen` and `clipboard-write` are granted by default. **/
  iframeAllowExtras?: string[];
  /** force a specific refererPolicy to be used in the iframe request **/
  referrerPolicy?: ReferrerPolicy;
  /** Callback to resolve permalink URLs. If provided, this will be called when generating permalinks
   * to allow the host app to customize the URL. If not provided, Superset's default URL is used. */
  resolvePermalinkUrl?: ResolvePermalinkUrlFn;
  /** Timeout, in milliseconds, applied to each `fetchGuestToken` call so a host
   * callback that never resolves cannot hang the embed/refresh cycle. Defaults
   * to 30000ms. Set to 0 to disable the timeout. */
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

/**
 * Callback to resolve permalink URLs.
 * Receives the permalink key and returns the full URL to use for the permalink.
 */
export type ResolvePermalinkUrlFn = (params: {
  /** The permalink key (e.g., "xyz789") */
  key: string;
}) => string | Promise<string>;

export type EmbeddedDashboard = {
  getScrollSize: () => Promise<Size>;
  unmount: () => void;
  getDashboardPermalink: (anchor: string) => Promise<string>;
  getActiveTabs: () => Promise<string[]>;
  observeDataMask: (callbackFn: ObserveDataMaskCallbackFn) => void;
  getDataMask: () => Promise<Record<string, any>>;
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

  // Wrap the host-provided fetchGuestToken so a callback that never settles
  // cannot hang the initial embed or a later refresh cycle.
  function fetchGuestTokenWithTimeout(): Promise<string> {
    return withTimeout(
      fetchGuestToken(),
      guestTokenFetchTimeoutMs,
      "fetchGuestToken",
    );
  }

  log("embedding");

  if (supersetDomain.endsWith("/")) {
    supersetDomain = supersetDomain.slice(0, -1);
  }

  function calculateConfig() {
    let configNumber = 0;
    if (dashboardUiConfig) {
      if (dashboardUiConfig.hideTitle) {
        configNumber += 1;
      }
      if (dashboardUiConfig.hideTab) {
        configNumber += 2;
      }
      if (dashboardUiConfig.hideChartControls) {
        configNumber += 8;
      }
      if (dashboardUiConfig.emitDataMasks) {
        configNumber += 16;
      }
      if (dashboardUiConfig.showRowLimitWarning) {
        configNumber += 32;
      }
    }
    return configNumber;
  }

  async function mountIframe(): Promise<Switchboard> {
    return new Promise((resolve) => {
      const iframe = document.createElement("iframe");
      const dashboardConfigUrlParams = dashboardUiConfig
        ? { uiConfig: `${calculateConfig()}` }
        : undefined;
      const filterConfig = dashboardUiConfig?.filters || {};
      const filterConfigKeys = Object.keys(filterConfig);
      const filterConfigUrlParams = Object.fromEntries(
        filterConfigKeys.map((key) => [
          DASHBOARD_UI_FILTER_CONFIG_URL_PARAM_KEY[key],
          filterConfig[key],
        ]),
      );

      // Allow url query parameters from dashboardUiConfig.urlParams to override the ones from filterConfig
      const urlParams = {
        ...dashboardConfigUrlParams,
        ...filterConfigUrlParams,
        ...dashboardUiConfig?.urlParams,
      };
      const urlParamsString = Object.keys(urlParams).length
        ? "?" + new URLSearchParams(urlParams).toString()
        : "";

      // set up the iframe's sandbox configuration
      iframe.sandbox.add("allow-same-origin"); // needed for postMessage to work
      iframe.sandbox.add("allow-scripts"); // obviously the iframe needs scripts
      iframe.sandbox.add("allow-presentation"); // for fullscreen charts
      iframe.sandbox.add("allow-downloads"); // for downloading charts as image
      iframe.sandbox.add("allow-forms"); // for forms to submit
      iframe.sandbox.add("allow-popups"); // for exporting charts as csv
      // additional sandbox props
      iframeSandboxExtras.forEach((key: string) => {
        iframe.sandbox.add(key);
      });
      // force a specific refererPolicy to be used in the iframe request
      if (referrerPolicy) {
        iframe.referrerPolicy = referrerPolicy;
      }

      // add the event listener before setting src, to be 100% sure that we capture the load event
      iframe.addEventListener("load", () => {
        // MessageChannel allows us to send and receive messages smoothly between our window and the iframe
        // See https://developer.mozilla.org/en-US/docs/Web/API/Channel_Messaging_API
        const commsChannel = new MessageChannel();
        const ourPort = commsChannel.port1;
        const theirPort = commsChannel.port2;

        // Send one of the message channel ports to the iframe to initialize embedded comms
        // See https://developer.mozilla.org/en-US/docs/Web/API/Window/postMessage
        // we know the content window isn't null because we are in the load event handler.
        iframe.contentWindow!.postMessage(
          { type: IFRAME_COMMS_MESSAGE_TYPE, handshake: "port transfer" },
          supersetDomain,
          [theirPort],
        );
        log("sent message channel to the iframe");

        // return our port from the promise
        resolve(
          new Switchboard({
            port: ourPort,
            name: "superset-embedded-sdk",
            debug,
          }),
        );
      });
      iframe.src = `${supersetDomain}/embedded/${id}${urlParamsString}`;
      iframe.title = iframeTitle;
      iframe.style.background = "transparent";
      // Permissions Policy features the embedded dashboard relies on. Modern
      // browsers gate these APIs on the iframe's `allow` attribute regardless
      // of sandbox flags, so we include them by default. Host apps can extend
      // the list via `iframeAllowExtras`.
      const allowFeatures = Array.from(
        new Set(["fullscreen", "clipboard-write", ...iframeAllowExtras]),
      );
      iframe.setAttribute("allow", allowFeatures.join("; "));
      //@ts-ignore
      mountPoint.replaceChildren(iframe);
      log("placed the iframe");
    });
  }

  let guestToken: string;
  let ourPort: Switchboard;
  try {
    [guestToken, ourPort] = await Promise.all([
      fetchGuestTokenWithTimeout(),
      mountIframe(),
    ]);
  } catch (err) {
    // If the initial token fetch (or timeout) rejects after the iframe has
    // already been mounted, tear down the partially initialized iframe so the
    // host isn't left with an orphaned embedded dashboard before rethrowing.
    //@ts-ignore
    mountPoint.replaceChildren();
    throw err;
  }

  ourPort.emit("guestToken", { guestToken });
  log("sent guest token");

  // Track the pending refresh timer so it can be cancelled on unmount, and
  // stop the cycle once unmounted so it cannot leak across mount/unmount cycles.
  let refreshTimer: ReturnType<typeof setTimeout> | undefined;
  let unmounted = false;

  async function refreshGuestToken() {
    if (unmounted) return;
    try {
      const newGuestToken = await fetchGuestTokenWithTimeout();
      if (unmounted) return;
      ourPort.emit("guestToken", { guestToken: newGuestToken });
      refreshTimer = setTimeout(
        refreshGuestToken,
        getGuestTokenRefreshTiming(newGuestToken),
      );
    } catch (err) {
      // A transient fetch failure or timeout must not permanently stop the
      // refresh cycle. Log it and retry so the session can recover once the
      // host callback succeeds again.
      log("failed to refresh guest token, will retry:", err);
      if (unmounted) return;
      refreshTimer = setTimeout(
        refreshGuestToken,
        DEFAULT_TOKEN_REFRESH_RETRY_MS,
      );
    }
  }

  refreshTimer = setTimeout(
    refreshGuestToken,
    getGuestTokenRefreshTiming(guestToken),
  );

  // Register the resolvePermalinkUrl method for the iframe to call
  // Returns null if no callback provided or on error, allowing iframe to use default URL
  ourPort.start();
  ourPort.defineMethod(
    "resolvePermalinkUrl",
    async ({ key }: { key: string }): Promise<string | null> => {
      if (!resolvePermalinkUrl) {
        return null;
      }
      try {
        return await resolvePermalinkUrl({ key });
      } catch (error) {
        log("Error in resolvePermalinkUrl callback:", error);
        return null;
      }
    },
  );

  function unmount() {
    log("unmounting");
    unmounted = true;
    if (refreshTimer !== undefined) {
      clearTimeout(refreshTimer);
      refreshTimer = undefined;
    }
    //@ts-ignore
    mountPoint.replaceChildren();
  }

  const getScrollSize = () => ourPort.get<Size>("getScrollSize");
  const getDashboardPermalink = (anchor: string) =>
    ourPort.get<string>("getDashboardPermalink", { anchor });
  const getActiveTabs = () => ourPort.get<string[]>("getActiveTabs");
  const getDataMask = () => ourPort.get<Record<string, any>>("getDataMask");
  const getChartStates = () =>
    ourPort.get<Record<string, any>>("getChartStates");
  const getChartDataPayloads = (params?: { chartId?: number }) =>
    ourPort.get<Record<string, any>>("getChartDataPayloads", params);
  const observeDataMask = (callbackFn: ObserveDataMaskCallbackFn) => {
    ourPort.defineMethod("observeDataMask", callbackFn);
  };
  // TODO: Add proper types once theming branch is merged
  const setThemeConfig = async (
    themeConfig: Record<string, any>,
  ): Promise<void> => {
    try {
      ourPort.emit("setThemeConfig", { themeConfig });
      log("Theme config sent successfully (or at least message dispatched)");
    } catch (error) {
      log(
        'Error sending theme config. Ensure the iframe side implements the "setThemeConfig" method.',
      );
      throw error;
    }
  };

  const setThemeMode = (mode: ThemeMode): void => {
    try {
      ourPort.emit("setThemeMode", { mode });
      log(`Theme mode set to: ${mode}`);
    } catch (error) {
      log(
        'Error sending theme mode. Ensure the iframe side implements the "setThemeMode" method.',
      );
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
    getChartStates,
    getChartDataPayloads,
    setThemeConfig,
    setThemeMode,
  };
}
