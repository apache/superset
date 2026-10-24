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
 * not correctness.
 *
 * Authentication is in-band. Every connection attempt first fetches a short-lived
 * ticket from `/api/v1/realtime/token/`, opens the socket, and sends it as the
 * first `auth` frame; the socket is reported `open` only once the server has
 * acknowledged it (`realtime.auth`). Before the ticket expires, a fresh one is
 * sent on the open socket, so a long-lived connection never tears down to
 * re-authenticate. No credential rides the handshake or the URL.
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
const WS_OPEN = 1;

const TICKET_ENDPOINT = '/api/v1/realtime/token/';
// Topic of the server's acknowledgement of an `auth` frame.
const AUTH_TOPIC = 'realtime.auth';
// The server closes with this code when the connection never authenticated, its
// ticket was invalid, or its ticket expired; a fresh ticket fixes it, so the
// client reconnects immediately rather than backing off.
const AUTH_CLOSE_CODE = 4401;
// The server closes with this code when a refresh named another principal.
const FORBIDDEN_CLOSE_CODE = 4403;
// How long to wait for the server to acknowledge the first `auth` frame.
const AUTH_ACK_TIMEOUT_MS = 10000;
// Fraction of the ticket lifetime after which a fresh ticket is sent on the open
// socket, leaving the remaining quarter as margin for retries.
const REFRESH_FRACTION = 0.75;
const REFRESH_RETRY_BASE_MS = 1000;
const REFRESH_RETRY_MAX_MS = 30000;

let socket: WebSocket | undefined;
let reconnectTimeoutId: number;
let refreshTimeoutId: number;
let authTimeoutId: number;
// When the ticket the server last acknowledged expires (epoch ms).
let ticketExpiresAtMs = 0;
let enabled = false;
let url: string | undefined;
let started = false;
// Bumped on every (re)configuration so an in-flight reconnect, ticket fetch, or
// refresh scheduled against a superseded socket detects it is stale and stops.
let generation = 0;
// Identifies the latest connection attempt within a generation. Every attempt
// takes a new value, so a ticket fetch, ack, timer or close event belonging to an
// earlier attempt can tell it has been superseded and must not touch the
// current connection.
let attemptSeq = 0;
const handlersByTopic = new Map<string, Set<RealtimeHandler>>();

// Why a socket became OPEN, passed to open-listeners so a consumer can decide
// whether to reconcile: `initial` (first connect), `reconnect` (recovered from a
// drop — a message may have been missed), or `rebind` (the server acknowledged a
// changed tab id on the open socket — a message sent to the old per-tab channel
// may have been missed). Ordinary ticket refreshes happen on the open socket and
// raise no event.
export type RealtimeOpenReason = 'initial' | 'reconnect' | 'rebind';

type RealtimeOpenListener = (reason: RealtimeOpenReason) => void;

// Fired every time a socket transitions to OPEN, with the reason (see above), so
// a feature can reconcile state it may have missed while the socket was down.
const openListeners = new Set<RealtimeOpenListener>();

// Connection health, surfaced so a feature can reconcile via its authorized REST
// API on a reconnect and, crucially, stop waiting on a genuinely-down socket
// (`unhealthy`) instead of hanging until a long give-up timeout. `unauthorized`
// is terminal: the ticket endpoint refused this session (logged out, or the
// realtime permission was removed), so the client stops connecting.
export type RealtimeConnectionState =
  | 'connecting'
  | 'open'
  | 'reconnecting'
  | 'unhealthy'
  | 'unauthorized';

type RealtimeStateListener = (state: RealtimeConnectionState) => void;

const stateListeners = new Set<RealtimeStateListener>();

let currentState: RealtimeConnectionState = 'connecting';

/**
 * The current connection state. Consumers that register after a transition
 * (e.g. a chart request started while the transport is `unauthorized`) read it
 * here instead of relying on having observed the transition.
 */
export const getRealtimeState = (): RealtimeConnectionState => currentState;

// Consecutive socket closes (or connect failures) with no intervening OPEN. Reset
// to 0 on OPEN. Drives the reconnect backoff and the `unhealthy` transition.
let reconnectAttempts = 0;

/**
 * Register a listener fired on every connection-state transition
 * (`connecting`/`open`/`reconnecting`/`unhealthy`/`unauthorized`); returns an
 * unsubscribe function. Use it to reconcile on reconnect and to give up promptly
 * when the socket is `unhealthy` rather than waiting out a long timeout.
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
  currentState = state;
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
 * it can skip an expensive reconcile on the `initial` connect and only reconcile
 * on a real `reconnect` after a drop.
 */
export const subscribeRealtimeOpen = (
  listener: RealtimeOpenListener,
): (() => void) => {
  openListeners.add(listener);
  return () => {
    openListeners.delete(listener);
  };
};

const parseRealtimeMessage = (rawData: string): RealtimeMessage | null => {
  try {
    const parsed: unknown = JSON.parse(rawData) ?? {};
    if (!parsed || typeof parsed !== 'object') return null;
    const { topic, payload } = parsed as {
      topic?: unknown;
      payload?: unknown;
    };
    if (typeof topic !== 'string') return null;
    return { topic, payload };
  } catch (err) {
    logging.warn('Failed to parse realtime message', err);
    return null;
  }
};

const deliverRealtimeMessage = (message: RealtimeMessage): void => {
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

/**
 * Parse a raw socket message and dispatch the `{topic, payload}` envelope to the
 * handlers registered for its topic. Exported for tests. Strictly best-effort:
 * malformed data and a throwing handler are logged and swallowed, never
 * propagated.
 */
export const dispatchRealtimeMessage = (rawData: string): void => {
  const message = parseRealtimeMessage(rawData);
  if (message) deliverRealtimeMessage(message);
};

// Build the per-connection ws URL. The configured endpoint may be absolute
// (`ws://host/`) or root-relative (`/superset-ws`, behind a same-origin proxy),
// so resolve it against the page URL and normalize an http(s) result to ws(s).
// The stored base `url` is left untouched so connectRealtime's idempotency
// compare stays stable.
const buildConnectUrl = (baseUrl: string): string => {
  try {
    const base =
      typeof window !== 'undefined' ? window.location.href : undefined;
    const parsed = new URL(baseUrl, base);
    if (parsed.protocol === 'http:') parsed.protocol = 'ws:';
    else if (parsed.protocol === 'https:') parsed.protocol = 'wss:';
    return parsed.toString();
  } catch {
    return baseUrl;
  }
};

const hasActiveSocket = (): boolean => socket?.readyState === WS_OPEN;

const clearTimers = (): void => {
  if (reconnectTimeoutId) clearTimeout(reconnectTimeoutId);
  if (refreshTimeoutId) clearTimeout(refreshTimeoutId);
  if (authTimeoutId) clearTimeout(authTimeoutId);
};

const teardownSocket = (): void => {
  clearTimers();
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

interface Ticket {
  token: string;
  expiresInMs: number;
}

/** Fetch a fresh connection ticket for the current session. */
const fetchTicket = async (): Promise<Ticket> => {
  const { json } = await SupersetClient.get({ endpoint: TICKET_ENDPOINT });
  const { token, expires_in: expiresIn } = (json ?? {}) as {
    token?: unknown;
    expires_in?: unknown;
  };
  if (typeof token !== 'string' || typeof expiresIn !== 'number') {
    throw new Error('Malformed realtime ticket response');
  }
  return { token, expiresInMs: expiresIn * 1000 };
};

/**
 * Whether a ticket request failed because the session may not use the transport
 * (no session, or no realtime permission). Retrying cannot succeed.
 */
const isUnauthorizedError = (err: unknown): boolean => {
  const status = (err as { status?: unknown } | null)?.status;
  return status === 401 || status === 403;
};

// Tab ids carried by `auth` frames the server has not acknowledged yet, oldest
// first, and the tab id the server last acknowledged. The server answers every
// frame in order, so comparing the two tells whether an ack rebound the tab.
let unackedTabIds: string[] = [];
let ackedTabId: string | undefined;

const sendAuthFrame = (ws: WebSocket, token: string): void => {
  const tabId = getTabId();
  ws.send(JSON.stringify({ type: 'auth', token, tab_id: tabId }));
  unackedTabIds.push(tabId);
};

const notifyOpen = (reason: RealtimeOpenReason): void => {
  openListeners.forEach(listener => {
    try {
      listener(reason);
    } catch (err) {
      logging.warn('Realtime open-listener error', err);
    }
  });
};

// Stop connecting after the server refused this session. Closes any live socket
// without scheduling a reconnect.
const enterUnauthorized = (): void => {
  teardownSocket();
  emitState('unauthorized');
};

const refreshRetryDelayMs = (attempt: number): number =>
  Math.min(REFRESH_RETRY_BASE_MS * 2 ** attempt, REFRESH_RETRY_MAX_MS);

// Send a fresh ticket on the open socket `ws`. A transient ticket failure is
// retried with backoff until the current ticket expires; past it the server closes the socket
// with AUTH_CLOSE_CODE and the reconnect path takes over. The server's
// `realtime.auth` reply schedules the next refresh.
function refreshTicket(
  thisGeneration: number,
  ws: WebSocket,
  attempt = 0,
): void {
  fetchTicket().then(
    ({ token }) => {
      if (thisGeneration !== generation || socket !== ws) return;
      if (ws.readyState !== WS_OPEN) return;
      try {
        sendAuthFrame(ws, token);
      } catch (err) {
        logging.warn('Failed to send realtime auth refresh', err);
      }
    },
    err => {
      if (thisGeneration !== generation || socket !== ws) return;
      if (isUnauthorizedError(err)) {
        enterUnauthorized();
        return;
      }
      const delay = refreshRetryDelayMs(attempt);
      if (Date.now() + delay >= ticketExpiresAtMs) return;
      refreshTimeoutId = window.setTimeout(
        () => refreshTicket(thisGeneration, ws, attempt + 1),
        delay,
      );
    },
  );
}

// Declared as a hoisted function so scheduleReconnect (above) can reference it
// for the mutual reconnect recursion without a use-before-define cycle.
async function openSocket(
  thisGeneration: number,
  reason: RealtimeOpenReason,
): Promise<void> {
  if (thisGeneration !== generation) return;
  if (!enabled || !url || typeof WebSocket === 'undefined') return;
  attemptSeq += 1;
  const attempt = attemptSeq;
  const isCurrent = () =>
    thisGeneration === generation && attempt === attemptSeq;
  emitState('connecting');

  let ticket: Ticket;
  try {
    ticket = await fetchTicket();
  } catch (err) {
    if (!isCurrent()) return;
    if (isUnauthorizedError(err)) {
      enterUnauthorized();
      return;
    }
    logging.warn('Failed to fetch realtime ticket', err);
    scheduleReconnect(thisGeneration);
    return;
  }
  if (!isCurrent()) return;

  let ws: WebSocket;
  try {
    ws = new WebSocket(buildConnectUrl(url));
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
  unackedTabIds = [];
  ackedTabId = undefined;
  // Set once the server acknowledges the first `auth` frame.
  let authenticated = false;

  ws.onopen = () => {
    if (thisGeneration !== generation || socket !== ws) return;
    try {
      sendAuthFrame(ws, ticket.token);
    } catch (err) {
      logging.warn('Failed to send realtime auth frame', err);
    }
    // A connection the server never acknowledges (a proxy that swallows frames,
    // an overloaded server) is abandoned and retried rather than reported open.
    authTimeoutId = window.setTimeout(() => {
      if (thisGeneration !== generation || socket !== ws || authenticated) {
        return;
      }
      teardownSocket();
      scheduleReconnect(thisGeneration);
    }, AUTH_ACK_TIMEOUT_MS);
  };

  const handleAuthAck = (payload: unknown): void => {
    const { status, expires_in: expiresIn } = (payload ?? {}) as {
      status?: unknown;
      expires_in?: unknown;
    };
    if (status !== 'ok' || typeof expiresIn !== 'number') return;
    if (refreshTimeoutId) clearTimeout(refreshTimeoutId);
    ticketExpiresAtMs = Date.now() + expiresIn * 1000;
    refreshTimeoutId = window.setTimeout(
      () => refreshTicket(thisGeneration, ws),
      expiresIn * 1000 * REFRESH_FRACTION,
    );
    const tabId = unackedTabIds.shift();
    if (authenticated) {
      if (tabId !== undefined && tabId !== ackedTabId) {
        ackedTabId = tabId;
        notifyOpen('rebind');
      }
      return;
    }
    authenticated = true;
    ackedTabId = tabId;
    if (authTimeoutId) clearTimeout(authTimeoutId);
    // Recovered: reset the failure counter and report a healthy connection.
    reconnectAttempts = 0;
    emitState('open');
    notifyOpen(reason);
  };

  ws.onmessage = (event: MessageEvent) => {
    if (thisGeneration !== generation || socket !== ws) return;
    const message = parseRealtimeMessage(String(event.data));
    if (!message) return;
    if (message.topic === AUTH_TOPIC) {
      handleAuthAck(message.payload);
    } else if (authenticated) {
      deliverRealtimeMessage(message);
    }
  };

  ws.onclose = (event: CloseEvent) => {
    if (thisGeneration !== generation || socket !== ws) return;
    clearTimers();
    socket = undefined;
    if (
      authenticated &&
      (event.code === AUTH_CLOSE_CODE || event.code === FORBIDDEN_CLOSE_CODE)
    ) {
      // The ticket expired (or was refused) on a socket that had been healthy:
      // reconnect right away with a fresh ticket instead of backing off.
      emitState('reconnecting');
      openSocket(thisGeneration, 'reconnect');
      return;
    }
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
// new id, so tab-targeted status events would miss it. Re-authenticate on the
// open socket so the server rebinds the tab channel; no reconnect is needed.
// A socket still connecting reads the current id when it sends its first frame.
subscribeTabIdChange(() => {
  if (!enabled || !socket || socket.readyState !== WS_OPEN) return;
  if (refreshTimeoutId) clearTimeout(refreshTimeoutId);
  refreshTicket(generation, socket);
});

// Test-only: reset module state between cases.
export const resetRealtimeForTests = (): void => {
  disconnectRealtime();
  handlersByTopic.clear();
  openListeners.clear();
  stateListeners.clear();
  currentState = 'connecting';
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
