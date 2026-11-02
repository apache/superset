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

/**
 * Shared client for the realtime WebSocket transport (`superset-websocket`).
 *
 * Owns the single browser socket and fans every message out to handlers
 * registered for its topic, so multiple features share one connection: async
 * chart-data completion (`task.status`, see `asyncEvent.ts`) and realtime list
 * views (`entity.changed` nudges, see `useListViewResource`). The server forwards
 * a generic `{topic, payload}` envelope — the semantic topic separated from the
 * route it arrived by — and this client dispatches purely on `topic`; each
 * handler interprets `payload` for its own feature.
 *
 * The transport is strictly best-effort: it is only an acceleration layer over
 * each feature's own authorized fetch/poll, so a socket outage costs latency,
 * not correctness. Connection auth is the `superset-ws-token` JWT cookie, which
 * rides the handshake automatically (same-host requirement).
 */
import { SupersetClient } from '@superset-ui/core';
import { logging } from '@apache-superset/core/utils';
import getBootstrapData from 'src/utils/getBootstrapData';
import { getTabId, subscribeTabIdChange } from 'src/hooks/useTabId';

/** The generic envelope the server forwards to the browser. */
export interface RealtimeMessage {
  topic: string;
  payload: unknown;
}

/** A topic handler receives the message payload; the topic already matched. */
type RealtimeHandler = (payload: unknown) => void;

type RealtimeConfig = {
  WEBSOCKET_ENABLE?: boolean;
  WEBSOCKET_URL?: string;
  WEBSOCKET_JWT_EXPIRATION_SECONDS?: number;
};

// Reconnect backoff after the socket closes. The socket is a first-class
// transport when enabled, so it reconnects indefinitely; the delay grows
// exponentially (with jitter) up to a cap so a persistently-down server is not
// hammered every few seconds while a transient blip still recovers fast.
const RECONNECT_BASE_MS = 1000;
const RECONNECT_MAX_MS = 30000;
// After this many consecutive closes with no intervening OPEN, the connection is
// reported `unhealthy` so waiters can stop waiting on it (bounded, rather than a
// silent multi-minute hang) instead of assuming a message is merely in flight.
const UNHEALTHY_AFTER_ATTEMPTS = 3;
const WS_CONNECTING = 0;
const WS_OPEN = 1;

// Fraction of the token lifetime after which the client proactively refreshes the
// channel cookie and reconnects, so the socket rides a fresh token before the
// server terminates it at expiry (see Finding 6 / superset/websocket/channel.py's
// sliding-window re-mint). Past the 0.5 sliding-window boundary (and clear of it,
// so timer jitter can't land exactly on the boundary and miss the re-mint), while
// still leaving ample margin before expiry.
const KEEPALIVE_FRACTION = 0.6;
// An authed, same-origin GET whose response passes through the Flask
// `after_request` hook that (re)mints the ws cookie. Any authed endpoint works;
// `me` is the cheapest stable one.
const COOKIE_REFRESH_ENDPOINT = '/api/v1/me/';

let socket: WebSocket | undefined;
let reconnectTimeoutId: number;
let keepaliveTimeoutId: number;
// Token lifetime (ms) from bootstrap config; 0 disables the proactive keepalive.
let tokenLifetimeMs = 0;
let enabled = false;
let url: string | undefined;
let started = false;
// Bumped on every (re)configuration so an in-flight reconnect scheduled against
// a superseded socket detects it is stale and stops.
let generation = 0;
const handlersByTopic = new Map<string, Set<RealtimeHandler>>();
// Fired every time a socket transitions to OPEN (initial connect and each
// reconnect), so a feature can reconcile state it may have missed while the
// socket was down (see asyncEvent's reconnect catch-up).
// Why a socket became OPEN, passed to open-listeners so a consumer can decide
// whether to reconcile: `initial` (first connect), `reconnect` (recovered from a
// drop — a message may have been missed), or `keepalive` (a planned pre-expiry
// token refresh — seamless, so an expensive reconcile isn't warranted).
export type RealtimeOpenReason = 'initial' | 'reconnect' | 'keepalive';

type RealtimeOpenListener = (reason: RealtimeOpenReason) => void;

// Fired every time a socket transitions to OPEN, with the reason (see above), so
// a feature can reconcile state it may have missed while the socket was down.
const openListeners = new Set<RealtimeOpenListener>();

// Connection health, surfaced so a feature can reconcile via its authorized REST
// API on a reconnect and, crucially, stop waiting on a genuinely-down socket
// (`unhealthy`) instead of hanging until a long give-up timeout.
export type RealtimeConnectionState =
  | 'connecting'
  | 'open'
  | 'reconnecting'
  | 'unhealthy';

type RealtimeStateListener = (state: RealtimeConnectionState) => void;

const stateListeners = new Set<RealtimeStateListener>();

// Consecutive socket closes (or connect failures) with no intervening OPEN. Reset
// to 0 on OPEN. Drives the reconnect backoff and the `unhealthy` transition.
let reconnectAttempts = 0;

/**
 * Register a listener fired on every connection-state transition
 * (`connecting`/`open`/`reconnecting`/`unhealthy`); returns an unsubscribe
 * function. Use it to reconcile on reconnect and to give up promptly when the
 * socket is `unhealthy` rather than waiting out a long timeout.
 */
export const subscribeRealtimeState = (
  listener: RealtimeStateListener,
): (() => void) => {
  stateListeners.add(listener);
  return () => {
    stateListeners.delete(listener);
  };
};

const emitState = (state: RealtimeConnectionState): void => {
  stateListeners.forEach(listener => {
    try {
      listener(state);
    } catch (err) {
      logging.warn('Realtime state-listener error', err);
    }
  });
};

// Exponential backoff with jitter, capped. `attempts` is the count of consecutive
// failed connects (>= 1 when scheduling a reconnect).
const reconnectDelayMs = (attempts: number): number => {
  const base = Math.min(
    RECONNECT_BASE_MS * 2 ** Math.max(0, attempts - 1),
    RECONNECT_MAX_MS,
  );
  // Jitter only spreads reconnects; it is not security-sensitive.
  return base + Math.random() * Math.min(base, RECONNECT_BASE_MS);
};

// Record a close/connect failure: bump the attempt counter, report `reconnecting`
// (or `unhealthy` once the socket has failed enough times), and schedule the next
// reconnect with backoff.
const scheduleReconnect = (thisGeneration: number): void => {
  reconnectAttempts += 1;
  emitState(
    reconnectAttempts >= UNHEALTHY_AFTER_ATTEMPTS
      ? 'unhealthy'
      : 'reconnecting',
  );
  reconnectTimeoutId = window.setTimeout(
    // eslint-disable-next-line no-use-before-define -- mutual reconnect recursion
    () => openSocket(thisGeneration, 'reconnect'),
    reconnectDelayMs(reconnectAttempts),
  );
};

/**
 * Register a listener fired when the socket (re)connects (transitions to OPEN);
 * returns an unsubscribe function. The listener receives a `RealtimeOpenReason` so
 * it can skip an expensive reconcile on a seamless `keepalive` reconnect and only
 * reconcile on a real `reconnect` after a drop.
 */
export const subscribeRealtimeOpen = (
  listener: RealtimeOpenListener,
): (() => void) => {
  openListeners.add(listener);
  return () => {
    openListeners.delete(listener);
  };
};

/**
 * Parse a raw socket message and dispatch the `{topic, payload}` envelope to the
 * handlers registered for its topic. Exported for tests. Strictly best-effort:
 * malformed data and a throwing handler are logged and swallowed, never
 * propagated.
 */
export const dispatchRealtimeMessage = (rawData: string): void => {
  let message: RealtimeMessage;
  try {
    const parsed: unknown = JSON.parse(rawData) ?? {};
    if (!parsed || typeof parsed !== 'object') return;
    const { topic, payload } = parsed as {
      topic?: unknown;
      payload?: unknown;
    };
    if (typeof topic !== 'string') return;
    message = { topic, payload };
  } catch (err) {
    logging.warn('Failed to parse realtime message', err);
    return;
  }
  const topicHandlers = handlersByTopic.get(message.topic);
  if (!topicHandlers) return;
  topicHandlers.forEach(handler => {
    try {
      handler(message.payload);
    } catch (err) {
      logging.warn('Realtime handler error', err);
    }
  });
};

// Build the per-connection ws URL. The configured endpoint may be absolute
// (`ws://host/`) or root-relative (`/superset-ws`, behind a same-origin proxy),
// so resolve it against the page URL and normalize an http(s) result to ws(s).
// The tab id is advertised as a query param so the server binds a per-tab channel
// for tab-targeted delivery. The stored base `url` is left untouched so
// connectRealtime's idempotency compare stays stable.
const buildConnectUrl = (baseUrl: string): string => {
  try {
    const base =
      typeof window !== 'undefined' ? window.location.href : undefined;
    const parsed = new URL(baseUrl, base);
    if (parsed.protocol === 'http:') parsed.protocol = 'ws:';
    else if (parsed.protocol === 'https:') parsed.protocol = 'wss:';
    parsed.searchParams.set('tab_id', getTabId());
    return parsed.toString();
  } catch {
    // Last resort (unparseable and no page URL): still advertise the tab id so
    // per-tab delivery works rather than silently falling back to polling.
    const sep = baseUrl.includes('?') ? '&' : '?';
    return `${baseUrl}${sep}tab_id=${encodeURIComponent(getTabId())}`;
  }
};

const hasActiveSocket = (): boolean =>
  socket?.readyState === WS_CONNECTING || socket?.readyState === WS_OPEN;

const teardownSocket = (): void => {
  if (reconnectTimeoutId) clearTimeout(reconnectTimeoutId);
  if (keepaliveTimeoutId) clearTimeout(keepaliveTimeoutId);
  if (socket) {
    // Detach handlers first so the closing socket can't schedule a reconnect
    // against the superseded generation.
    socket.onopen = null;
    socket.onmessage = null;
    socket.onclose = null;
    socket.onerror = null;
    try {
      socket.close();
    } catch {
      // ignore: closing an already-closed/broken socket is harmless
    }
    socket = undefined;
  }
};

// Declared as a hoisted function so scheduleReconnect (above) can reference it
// for the mutual reconnect recursion without a use-before-define cycle.
function openSocket(thisGeneration: number, reason: RealtimeOpenReason): void {
  if (thisGeneration !== generation) return;
  if (!enabled || !url || typeof WebSocket === 'undefined') return;
  const connectUrl = buildConnectUrl(url);
  emitState('connecting');
  let ws: WebSocket;
  try {
    ws = new WebSocket(connectUrl);
  } catch (err) {
    logging.warn('Failed to open realtime WebSocket', err);
    // A synchronous constructor throw would otherwise dead-end this generation
    // (no onclose fires). Treat it as a failed attempt and keep retrying with
    // backoff so a first-class socket recovers and a persistent failure surfaces
    // as `unhealthy`.
    scheduleReconnect(thisGeneration);
    return;
  }
  socket = ws;

  // Proactively refresh the channel cookie and reconnect before this
  // connection's token expires, so an idle realtime surface (one making no other
  // HTTP requests, e.g. a quiet list view) does not silently lose the socket at
  // JWT expiry. The GET re-mints the httponly cookie via the Flask after_request
  // hook (inside its sliding window); the reconnect then rides the fresh token.
  // Best-effort: reconnect regardless of the GET's outcome (a stale cookie just
  // fails the handshake, and onclose retries). This reconnect is `keepalive` (a
  // seamless handover), so open-listeners can skip an expensive reconcile.
  if (enabled && tokenLifetimeMs > 0) {
    keepaliveTimeoutId = window.setTimeout(() => {
      // Only hand off a socket that is still OPEN. Besides a superseded
      // generation or a replaced socket, guard on readyState: `onclose` merely
      // *schedules* a delayed reconnect (it doesn't clear `socket` or bump the
      // generation), so a just-closed socket still satisfies `socket === ws`. A
      // seamless keepalive handoff of a closed socket would cancel that real
      // `reconnect` and reopen as `keepalive` — and list views skip reconcile on
      // `keepalive`, so they'd miss entity changes from the actual outage.
      if (
        thisGeneration !== generation ||
        socket !== ws ||
        ws.readyState !== WS_OPEN
      ) {
        return;
      }
      SupersetClient.get({ endpoint: COOKIE_REFRESH_ENDPOINT })
        .catch(() => {})
        .finally(() => {
          if (
            thisGeneration !== generation ||
            socket !== ws ||
            ws.readyState !== WS_OPEN
          ) {
            return;
          }
          generation += 1;
          teardownSocket();
          openSocket(generation, 'keepalive');
        });
    }, tokenLifetimeMs * KEEPALIVE_FRACTION);
  }

  ws.onopen = () => {
    if (thisGeneration !== generation) return;
    // Recovered: reset the failure counter and report a healthy connection.
    reconnectAttempts = 0;
    emitState('open');
    openListeners.forEach(listener => {
      try {
        listener(reason);
      } catch (err) {
        logging.warn('Realtime open-listener error', err);
      }
    });
  };
  ws.onmessage = (event: MessageEvent) => {
    if (thisGeneration === generation)
      dispatchRealtimeMessage(String(event.data));
  };
  ws.onclose = () => {
    if (thisGeneration !== generation) return;
    scheduleReconnect(thisGeneration);
  };
  // Errors surface as a subsequent close; let onclose own the reconnect and
  // avoid logging the (payload-free) error event on every transient blip.
  ws.onerror = () => {};
}

/**
 * (Re)configure and (re)connect the shared socket. Idempotent and safe to call
 * repeatedly (e.g. from app bootstrap): it supersedes any prior socket. Reads
 * `WEBSOCKET_ENABLE` / `WEBSOCKET_URL` from bootstrap config when none is
 * passed. A no-op (and tears down any existing socket) when disabled.
 */
export const connectRealtime = (config?: RealtimeConfig): void => {
  const conf = config ?? getBootstrapData().common.conf;
  const nextEnabled = Boolean(conf?.WEBSOCKET_ENABLE);
  const nextUrl = conf?.WEBSOCKET_URL;

  if (
    started &&
    enabled === nextEnabled &&
    url === nextUrl &&
    (!nextEnabled || hasActiveSocket())
  ) {
    return;
  }

  teardownSocket();
  generation += 1;
  // Fresh (re)configuration: start the failure counter clean so a prior outage's
  // count can't make the first new attempt look unhealthy.
  reconnectAttempts = 0;
  started = true;
  enabled = nextEnabled;
  url = nextUrl;
  tokenLifetimeMs = (conf?.WEBSOCKET_JWT_EXPIRATION_SECONDS ?? 0) * 1000;
  openSocket(generation, 'initial');
};

/** Tear down the socket and stop reconnecting. */
export const disconnectRealtime = (): void => {
  generation += 1;
  reconnectAttempts = 0;
  teardownSocket();
};

/**
 * Register a handler for a realtime `topic`; returns an unsubscribe function. On
 * the first subscription this lazily connects the socket from bootstrap config
 * (unless `connectRealtime` was already called), so a feature can opt into
 * realtime purely by subscribing.
 */
export const subscribeRealtime = (
  topic: string,
  handler: RealtimeHandler,
): (() => void) => {
  let topicHandlers = handlersByTopic.get(topic);
  if (!topicHandlers) {
    topicHandlers = new Set();
    handlersByTopic.set(topic, topicHandlers);
  }
  topicHandlers.add(handler);
  if (!started) connectRealtime();
  return () => {
    const current = handlersByTopic.get(topic);
    if (!current) return;
    current.delete(handler);
    if (current.size === 0) handlersByTopic.delete(topic);
  };
};

// Keep the socket's per-tab channel in sync with the tab id. If this tab's id is
// reassigned (a duplicated tab resolving a TAB_ID_DENIED collision), the live
// socket stays bound to the old per-tab channel while new subscriptions use the
// new id, so tab-targeted status events would miss it. Reconnect to re-register
// under the current id (openSocket re-reads getTabId). No-op unless active.
subscribeTabIdChange(() => {
  if (!enabled || !hasActiveSocket()) return;
  generation += 1;
  teardownSocket();
  openSocket(generation, 'reconnect');
});

// Test-only: reset module state between cases.
export const resetRealtimeForTests = (): void => {
  disconnectRealtime();
  handlersByTopic.clear();
  openListeners.clear();
  stateListeners.clear();
  reconnectAttempts = 0;
  started = false;
  enabled = false;
  url = undefined;
};

// Test-only: simulate a socket (re)connect firing the open-listeners.
export const emitRealtimeOpenForTests = (
  reason: RealtimeOpenReason = 'reconnect',
): void => {
  openListeners.forEach(listener => listener(reason));
};
