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
 * Owns the single browser socket and fans every message out to registered
 * handlers, so multiple features share one connection: async chart-data
 * completion (per-principal `realtime:*` messages, see `asyncEvent.ts`) and
 * realtime list views (authenticated `entity-changes:*` nudges, see
 * `useListViewResource`). The server forwards a generic `{channel, payload}`
 * envelope and this client is deliberately payload-agnostic — each handler
 * routes on `channel` and interprets `payload` for its own feature.
 *
 * The transport is strictly best-effort: it is only an acceleration layer over
 * each feature's own authorized fetch/poll, so a socket outage costs latency,
 * not correctness. Connection auth is the `superset-ws-token` JWT cookie, which
 * rides the handshake automatically (same-host requirement).
 */
import { logging } from '@apache-superset/core/utils';
import getBootstrapData from 'src/utils/getBootstrapData';

/** The generic envelope the server forwards to the browser. */
export interface RealtimeMessage {
  channel: string;
  payload: unknown;
}

type RealtimeHandler = (message: RealtimeMessage) => void;

type RealtimeConfig = {
  WEBSOCKET_ENABLE?: boolean;
  WEBSOCKET_URL?: string;
};

// Backoff before reconnecting after the socket closes (mirrors the Node
// server's own subscribe retry). The socket is best-effort, so a generous
// delay is fine — each feature's poll/fetch covers the gap.
const RECONNECT_DELAY_MS = 5000;

let socket: WebSocket | undefined;
let reconnectTimeoutId: number;
let enabled = false;
let url: string | undefined;
let started = false;
// Bumped on every (re)configuration so an in-flight reconnect scheduled against
// a superseded socket detects it is stale and stops.
let generation = 0;
const handlers = new Set<RealtimeHandler>();

/**
 * Parse a raw socket message and dispatch the `{channel, payload}` envelope to
 * every handler. Exported for tests. Strictly best-effort: malformed data and a
 * throwing handler are logged and swallowed, never propagated.
 */
export const dispatchRealtimeMessage = (rawData: string): void => {
  let message: RealtimeMessage;
  try {
    const parsed: unknown = JSON.parse(rawData) ?? {};
    if (!parsed || typeof parsed !== 'object') return;
    const { channel, payload } = parsed as {
      channel?: unknown;
      payload?: unknown;
    };
    if (typeof channel !== 'string') return;
    message = { channel, payload };
  } catch (err) {
    logging.warn('Failed to parse realtime message', err);
    return;
  }
  handlers.forEach(handler => {
    try {
      handler(message);
    } catch (err) {
      logging.warn('Realtime handler error', err);
    }
  });
};

const openSocket = (thisGeneration: number): void => {
  if (thisGeneration !== generation) return;
  if (!enabled || !url || typeof WebSocket === 'undefined') return;
  let ws: WebSocket;
  try {
    ws = new WebSocket(url);
  } catch (err) {
    logging.warn('Failed to open realtime WebSocket', err);
    return;
  }
  socket = ws;
  ws.onmessage = (event: MessageEvent) => {
    if (thisGeneration === generation)
      dispatchRealtimeMessage(String(event.data));
  };
  ws.onclose = () => {
    if (thisGeneration !== generation) return;
    reconnectTimeoutId = window.setTimeout(
      () => openSocket(thisGeneration),
      RECONNECT_DELAY_MS,
    );
  };
  // Errors surface as a subsequent close; let onclose own the reconnect and
  // avoid logging the (payload-free) error event on every transient blip.
  ws.onerror = () => {};
};

const teardownSocket = (): void => {
  if (reconnectTimeoutId) clearTimeout(reconnectTimeoutId);
  if (socket) {
    // Detach handlers first so the closing socket can't schedule a reconnect
    // against the superseded generation.
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

/**
 * (Re)configure and (re)connect the shared socket. Idempotent and safe to call
 * repeatedly (e.g. from app bootstrap): it supersedes any prior socket. Reads
 * `WEBSOCKET_ENABLE` / `WEBSOCKET_URL` from bootstrap config when none is
 * passed. A no-op (and tears down any existing socket) when disabled.
 */
export const connectRealtime = (config?: RealtimeConfig): void => {
  const conf = config ?? getBootstrapData().common.conf;
  teardownSocket();
  generation += 1;
  started = true;
  enabled = Boolean(conf?.WEBSOCKET_ENABLE);
  url = conf?.WEBSOCKET_URL;
  openSocket(generation);
};

/** Tear down the socket and stop reconnecting. */
export const disconnectRealtime = (): void => {
  generation += 1;
  teardownSocket();
};

/**
 * Register a handler for every realtime message; returns an unsubscribe
 * function. On the first subscription this lazily connects the socket from
 * bootstrap config (unless `connectRealtime` was already called), so a feature
 * can opt into realtime purely by subscribing.
 */
export const subscribeRealtime = (handler: RealtimeHandler): (() => void) => {
  handlers.add(handler);
  if (!started) connectRealtime();
  return () => {
    handlers.delete(handler);
  };
};

// Test-only: reset module state between cases.
export const resetRealtimeForTests = (): void => {
  disconnectRealtime();
  handlers.clear();
  started = false;
  enabled = false;
  url = undefined;
};
