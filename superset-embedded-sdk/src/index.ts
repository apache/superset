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

/**
 * Method the SDK calls on a freshly navigated-to document to confirm that an
 * embedded Superset page is listening on the channel. Deliberately not a
 * method the page implements: the `Method "..." is not defined` error every
 * version replies with is itself the acknowledgement.
 */
const HANDSHAKE_PROBE_METHOD = "supersetEmbeddedSdkHandshake";

/** How long that document has to answer the handshake probe. */
const HANDSHAKE_PROBE_TIMEOUT_MS = 5_000;

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
 * Raised on the calls still in flight when the document they were sent to
 * goes away, because the iframe navigated or the dashboard was unmounted.
 * `Switchboard.get` settles only on a reply, and a document that is gone can
 * never send one, so without this the host would wait forever.
 */
export class PortClosedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PortClosedError";
  }
}

/**
 * A method the host exposes on the channel, as the registry of replayable
 * methods holds it. `never` in the argument position is what lets methods of
 * unrelated shapes share one registry: each one declares the arguments it
 * actually takes, and `defineHostMethod` — the only writer — keeps that
 * signature for the caller.
 */
type HostMethod = (args: never) => unknown;

/**
 * One end of a MessageChannel, plus everything scoped to the document on the
 * other end of it. A navigation inside the iframe replaces that document, so
 * the SDK opens a new channel and retires the previous connection.
 */
type Connection = {
  switchboard: Switchboard;
  port: MessagePort;
  /** Rejectors of the `get` calls still waiting for a reply on this port. */
  pending: Set<(err: Error) => void>;
  /** Whether the document on this port has been handed a guest token. */
  tokenSent: boolean;
  closed: boolean;
};

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
  /**
   * Applies a theme to the dashboard. The theme is remembered and re-applied
   * to the new document when the dashboard navigates to a page of its own.
   */
  setThemeConfig: (themeConfig: Record<string, any>) => void;
  /**
   * Sets the dashboard's theme mode. Like `setThemeConfig`, it is re-applied
   * after a navigation internal to the dashboard.
   */
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

  // Hoisted above `mountIframe`: its `load` listener fires on every load of the
  // iframe — including the ones a link internal to the dashboard triggers — and
  // has to re-authenticate the new document on the port it just created. The
  // definite assignment is the listener's: it runs before `mountIframe` resolves.
  let connection!: Connection;
  let refreshTimer: ReturnType<typeof setTimeout> | undefined;
  let unmounted = false;
  // Bumped by every token cycle, so a refresh left in flight by a reload stops
  // instead of emitting a stale token and arming a second timer.
  let generation = 0;
  // Methods the host defined on the port. A reloaded document has never heard
  // of them, so they are replayed on every new port.
  const hostMethods: Record<string, HostMethod> = {};
  // State the host pushed to the document with `emit` — the theme, today —
  // keyed by method name so the last value of each wins. A reloaded document
  // is a brand new realm holding none of it, so it is replayed as well.
  const hostState = new Map<string, unknown>();

  // Hand a freshly loaded document its own end of a new MessageChannel.
  function connect(iframe: HTMLIFrameElement): Connection {
    // MessageChannel allows us to send and receive messages smoothly between our window and the iframe
    // See https://developer.mozilla.org/en-US/docs/Web/API/Channel_Messaging_API
    const commsChannel = new MessageChannel();

    // Send one of the message channel ports to the iframe to initialize embedded comms
    // See https://developer.mozilla.org/en-US/docs/Web/API/Window/postMessage
    // we know the content window isn't null because we are called from the load event handler.
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
    // Starting before the replay is safe: the port was created microseconds
    // ago and cannot have anything queued yet, and the replay below runs
    // synchronously in this same task, before any message can be dispatched.
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

  // Retire a connection whose document is gone: reject whatever the host is
  // still awaiting on it, since no reply can ever come now, and close the port
  // so it stops holding on to its listeners.
  function closeConnection(conn: Connection | undefined, reason: string) {
    if (!conn || conn.closed) return;
    conn.closed = true;
    const pending = Array.from(conn.pending);
    conn.pending.clear();
    pending.forEach((reject) => reject(new PortClosedError(reason)));
    // Optional call so a host test double for MessageChannel needs no `close`.
    conn.port.close?.();
  }

  // Stop every cycle and let go of the channel. Shared by `unmount()` and by
  // the failure path of the initial token fetch.
  function teardown(reason: string) {
    unmounted = true;
    if (refreshTimer !== undefined) {
      clearTimeout(refreshTimer);
      refreshTimer = undefined;
    }
    closeConnection(connection, reason);
    //@ts-ignore
    mountPoint.replaceChildren();
  }

  // Define a method on the current port, and on every port that follows it.
  function defineHostMethod<A extends object>(
    name: string,
    fn: (args: A) => unknown,
  ) {
    hostMethods[name] = fn;
    connection.switchboard.defineMethod(name, fn);
  }

  // Push state to the current document and remember it, so the next document
  // to load is given it too.
  function emitHostState(method: string, args: unknown) {
    hostState.set(method, args);
    connection.switchboard.emit(method, args);
  }

  // Scope a `get` to the port it was issued on: if the document answers, the
  // promise settles as usual; if the document leaves first, `closeConnection`
  // rejects it rather than leaving the host waiting on a reply that the
  // departed document can no longer send.
  function portGet<T>(method: string, args?: unknown): Promise<T> {
    const conn = connection;
    if (conn.closed) {
      return Promise.reject(
        new PortClosedError(`"${method}" was called on a closed port`),
      );
    }
    return new Promise<T>((resolve, reject) => {
      conn.pending.add(reject);
      Promise.resolve(conn.switchboard.get<T>(method, args))
        .then(resolve, reject)
        .finally(() => conn.pending.delete(reject));
    });
  }

  // Arm the next refresh, replacing any timer already pending so that two
  // token cycles overlapping across a reload cannot leave two of them running.
  function armRefresh(delayMs: number) {
    if (refreshTimer !== undefined) clearTimeout(refreshTimer);
    refreshTimer = setTimeout(refreshGuestToken, delayMs);
  }

  async function mountIframe(): Promise<void> {
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
      let firstLoad = true;
      iframe.addEventListener("load", () => {
        // A detached iframe can still report a load, and has no content window
        // left to hand a port to.
        if (unmounted || !iframe.contentWindow) return;
        // Whatever the previous document was still being asked, it will never
        // answer now.
        closeConnection(connection, "the embedded page navigated away");
        connection = connect(iframe);
        if (firstLoad) {
          firstLoad = false;
          resolve();
          return;
        }
        // The dashboard followed a link of its own. The new document is waiting
        // for a guest token on THIS port, and the one we hold may be seconds
        // from expiring, so ask the host for a fresh one.
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

  let guestToken: string | undefined;
  try {
    [guestToken] = await Promise.all([
      fetchGuestTokenWithTimeout(),
      mountIframe(),
    ]);
  } catch (err) {
    // If the initial token fetch (or timeout) rejects after the iframe has
    // already been mounted, tear down the partially initialized iframe so the
    // host isn't left with an orphaned embedded dashboard before rethrowing.
    //
    // Unless the iframe navigated while this fetch was in flight: that reload
    // opened a token cycle of its own, and that cycle — not this one — decides
    // whether the embed lives, either by handing the document in front of the
    // user a token or by retrying until it can. Tearing down here would take a
    // dashboard that is already rendering away from the host, on the word of a
    // fetch nobody is waiting for any more.
    if (generation === 0) {
      teardown("the initial guest token fetch failed");
      throw err;
    }
    log("the initial guest token fetch failed, a reload has taken over:", err);
  }

  // Generation 0 is the fetch above. A reload while it was in flight has
  // already moved the chain on, and `deliverGuestToken` knows what that means.
  if (guestToken !== undefined) {
    deliverGuestToken(0, guestToken);
  }

  // Hand a token to the document currently on the channel, and arm the next
  // refresh. `gen` identifies the cycle that fetched it; a newer one means a
  // reload superseded this cycle, so it no longer arms a timer. It does still
  // hand the token over when the current document has none, because any valid
  // token gets that document rendering, and waiting for the newer cycle to
  // retry a failed fetch would leave the page blank for a full retry interval.
  function deliverGuestToken(gen: number, token: string) {
    if (unmounted) return;
    const ownsChain = gen === generation;
    if (ownsChain || !connection.tokenSent) {
      const firstTokenForDocument = !connection.tokenSent;
      connection.tokenSent = true;
      connection.switchboard.emit("guestToken", { guestToken: token });
      log("sent guest token");
      if (firstTokenForDocument) {
        // Replay what the host had pushed to the previous document. After the
        // token, so it arrives in the same order as on a first load, where the
        // host calls these once `embedDashboard` has resolved.
        hostState.forEach((args, method) => {
          connection.switchboard.emit(method, args);
        });
      }
    }
    if (ownsChain) {
      armRefresh(getGuestTokenRefreshTiming(token));
    }
  }

  // Re-authenticate a document that arrived through a navigation of the
  // iframe's own. Not all of those land on the embedded page: a link in a
  // Markdown chart can point at a plain Superset URL, or off site entirely,
  // and such a document never answers on the channel. Minting a guest token
  // for it would bill the host's endpoint for a document that cannot use it,
  // so the handshake is confirmed first.
  async function reauthenticate(conn: Connection) {
    if (!(await handshakeAcknowledged(conn))) {
      log("nothing answered the handshake, not fetching a guest token");
      return;
    }
    // Another load, or an unmount, overtook the probe.
    if (unmounted || conn !== connection) return;
    await refreshGuestToken();
  }

  // Any answer at all proves a Superset switchboard is listening, including
  // the error reply that an embedded page returns for a method it does not
  // know — which is every version of the page to date. Silence means we are
  // not talking to an embedded page, and the probe times out.
  async function handshakeAcknowledged(conn: Connection): Promise<boolean> {
    try {
      await withTimeout(
        Promise.resolve(conn.switchboard.get(HANDSHAKE_PROBE_METHOD)).catch(
          () => undefined,
        ),
        HANDSHAKE_PROBE_TIMEOUT_MS,
        "embedded page handshake",
      );
      return true;
    } catch {
      return false;
    }
  }

  // Emits on whichever port is current: a reload replaces it, and the document
  // behind the old one is gone.
  async function refreshGuestToken() {
    if (unmounted) return;
    const gen = ++generation;
    try {
      const newGuestToken = await fetchGuestTokenWithTimeout();
      if (unmounted) return;
      deliverGuestToken(gen, newGuestToken);
    } catch (err) {
      // A transient fetch failure or timeout must not permanently stop the
      // refresh cycle. Log it and retry so the session can recover once the
      // host callback succeeds again.
      log("failed to refresh guest token, will retry:", err);
      if (unmounted || gen !== generation) return;
      armRefresh(DEFAULT_TOKEN_REFRESH_RETRY_MS);
    }
  }

  // Register the resolvePermalinkUrl method for the iframe to call
  // Returns null if no callback provided or on error, allowing iframe to use default URL
  // Defined through `defineHostMethod` so a reloaded document gets it too.
  defineHostMethod(
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
    teardown("the dashboard was unmounted");
  }

  const getScrollSize = () => portGet<Size>("getScrollSize");
  const getDashboardPermalink = (anchor: string) =>
    portGet<string>("getDashboardPermalink", { anchor });
  const getActiveTabs = () => portGet<string[]>("getActiveTabs");
  const getDataMask = () => portGet<Record<string, any>>("getDataMask");
  // `observeDataMask` hands the host a mask with the change-trigger booleans
  // mixed in, so feeding that payload straight back into `setDataMask` is a
  // natural thing for a host to do. Keep only the entries that look like a
  // filter's mask, so those flags never reach the dashboard as filter ids.
  // Sent with `get` rather than `emit` so the iframe acknowledges the call:
  // an embedded page that predates `setDataMask` replies with an error instead
  // of dropping the message silently.
  const setDataMask = (dataMask: Record<string, any>) =>
    portGet<void>("setDataMask", {
      dataMask: Object.fromEntries(
        Object.entries(dataMask).filter(
          ([, mask]) => typeof mask === "object" && mask !== null,
        ),
      ),
    });
  const getChartStates = () => portGet<Record<string, any>>("getChartStates");
  const getChartDataPayloads = (params?: { chartId?: number }) =>
    portGet<Record<string, any>>("getChartDataPayloads", params);
  const observeDataMask = (callbackFn: ObserveDataMaskCallbackFn) => {
    defineHostMethod("observeDataMask", callbackFn);
  };
  // TODO: Add proper types once theming branch is merged
  const setThemeConfig = async (
    themeConfig: Record<string, any>,
  ): Promise<void> => {
    try {
      emitHostState("setThemeConfig", { themeConfig });
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
      emitHostState("setThemeMode", { mode });
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
    setDataMask,
    getChartStates,
    getChartDataPayloads,
    setThemeConfig,
    setThemeMode,
  };
}
