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

/**
 * @fileoverview The host side of the artifact bridge.
 *
 * A channel belongs to one iframe: it accepts only messages whose
 * `event.source` is that iframe's window and that carry its key, and it
 * enforces the capability grant and its limits itself. This is the
 * authoritative check: the runtime in the frame checks too, but the frame
 * runs untrusted code.
 *
 * A cross-filter ends up in the queries of other widgets, so the channel
 * accepts only values that it delivered to the frame, in the latest result of
 * that binding, for that dimension: the frame can point at its data, but
 * never write text of its own into another query.
 *
 * @example
 * ```typescript
 * const channel = createFrameChannel({ frame, grant, onRequest, onError });
 * frame.name = channel.name; // before the frame loads
 * frame.src = frameLink; // a short-lived link from the provider
 * channel.postData('revenue_by_region', result);
 * channel.postState(state);
 * ```
 */

import { Capability, isCapability } from './capabilities';
import {
  BindingData,
  DataEventValue,
  DataMessage,
  encodeFrameConfig,
  FrameErrorKind,
  FrameRequest,
  FrameState,
  parseFrameMessage,
  PROTOCOL_NAME,
  PROTOCOL_VERSION,
  REQUEST_CAPABILITY,
  StateMessage,
} from './protocol';

export interface ChannelError {
  /** `frame` for an error the artifact reported, `host` for a refusal. */
  source: 'frame' | 'host';
  message: string;
  /** For a frame error: how it surfaced. */
  kind?: FrameErrorKind;
  stack?: string;
}

/** The most a channel accepts from its frame. */
export interface BridgeLimits {
  /**
   * Queries that the frame's own requests may run while the channel is open:
   * a `query` runs one, a `refresh` one per binding it fetches again
   * (`refreshQueries`).
   */
  queries: number;
  /** Requests the frame may send in any one second. */
  requestsPerSecond: number;
  /** Values one cross-filter may carry. */
  crossFilterValues: number;
}

export const DEFAULT_BRIDGE_LIMITS: Readonly<BridgeLimits> = Object.freeze({
  queries: 16,
  requestsPerSecond: 10,
  crossFilterValues: 100,
});

/** How long a frame has to complete its handshake, by default. */
export const HANDSHAKE_TIMEOUT_MS = 15_000;

export interface FrameChannelOptions {
  /** The artifact's iframe, sandboxed with `allow-scripts` only. */
  frame: HTMLIFrameElement;
  /** The capabilities granted to the frame in this context. */
  grant: readonly Capability[];
  /**
   * Called for each well-formed request that the grant and the limits allow.
   * Check it against the manifest (declared bindings, parameters and events)
   * before acting on it.
   */
  onRequest: (request: FrameRequest) => void;
  /** Called for the frame's errors, and for messages the host refused. */
  onError: (error: ChannelError) => void;
  /**
   * Limits in place of {@link DEFAULT_BRIDGE_LIMITS}, such as the policy's.
   * One that isn't a number of zero or more keeps its default.
   */
  limits?: Partial<BridgeLimits>;
  /**
   * The queries a `refresh` runs: one for each binding the manifest declares,
   * when a refresh fetches them all again. A refresh costs at least one.
   * Without a number of zero or more, it costs one per binding delivered so
   * far.
   */
  refreshQueries?: number;
  /**
   * Called once if the frame hasn't completed its handshake
   * `handshakeTimeoutMs` after the channel opened, as when its link expired
   * before it loaded. Open a new link then: this one is spent.
   */
  onHandshakeTimeout?: () => void;
  handshakeTimeoutMs?: number;
  /** The window to listen on; the page's own window by default. */
  hostWindow?: Window;
}

export interface FrameChannel {
  /** The value for the iframe's `name` attribute; set it before it loads. */
  readonly name: string;
  /**
   * Send the frame its state, trimmed to the grant. Before the frame's
   * handshake, the latest state is held and sent when the frame is ready.
   */
  postState(state: FrameState): void;
  /**
   * Send the frame a binding's result, if the grant covers `data`. Posting
   * the result last sent for that binding again sends nothing, so a host can
   * post every binding whenever one changes. Before the handshake, each
   * binding's latest result is held. Don't change a result once posted: the
   * channel checks cross-filters against it.
   */
  postData(binding: string, data: BindingData): void;
  /** Stop listening and drop anything held. */
  dispose(): void;
}

/** A fresh channel key: 128 random bits, as 32 hex digits. */
export function createChannelKey(): string {
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
}

/** `state` without what the grant doesn't cover. */
function stateForGrant(
  state: FrameState,
  granted: ReadonlySet<Capability>,
): FrameState {
  const theme = granted.has(Capability.THEME) ? state.theme : undefined;
  return {
    status: state.status,
    filters: granted.has(Capability.DATA) ? state.filters : [],
    ...(theme === undefined ? {} : { theme }),
    ...(state.error === undefined ? {} : { error: state.error }),
  };
}

const hasOwn = (row: object, key: string): boolean =>
  Object.prototype.hasOwnProperty.call(row, key);

const isCount = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0;

function limitsOf(limits: Partial<BridgeLimits> | undefined): BridgeLimits {
  const pick = (name: keyof BridgeLimits): number => {
    const value: unknown = limits?.[name];
    return isCount(value) ? value : DEFAULT_BRIDGE_LIMITS[name];
  };
  return {
    queries: pick('queries'),
    requestsPerSecond: pick('requestsPerSecond'),
    crossFilterValues: pick('crossFilterValues'),
  };
}

/**
 * Open the host side of a frame's bridge.
 *
 * Use a new iframe, and a new channel, for every load of an artifact: the
 * key travels in the iframe's `name`, and the runtime clears it once read.
 */
export function createFrameChannel({
  frame,
  grant,
  onRequest,
  onError,
  limits,
  refreshQueries,
  onHandshakeTimeout,
  handshakeTimeoutMs = HANDSHAKE_TIMEOUT_MS,
  hostWindow,
}: FrameChannelOptions): FrameChannel {
  const host = hostWindow ?? window;
  const key = createChannelKey();
  const granted = new Set(grant.filter(isCapability));
  const caps = limitsOf(limits);
  const name = encodeFrameConfig({
    k: key,
    grant: [...granted],
    origin: host.location.origin,
  });
  let latest: FrameState | undefined;
  // Each binding's latest result, until the frame is ready for it.
  const held = new Map<string, BindingData>();
  // Each binding's result as last sent, and the values of its dimensions,
  // read from it when a cross-filter first names them.
  const delivered = new Map<string, BindingData>();
  const deliveredValues = new Map<string, Map<string, ReadonlySet<unknown>>>();
  let queries = 0;
  let arrivals: number[] = [];
  let throttled = false;
  let ready = false;
  let disposed = false;

  const handshakeTimer =
    onHandshakeTimeout === undefined
      ? undefined
      : globalThis.setTimeout(() => {
          if (!ready && !disposed) onHandshakeTimeout();
        }, handshakeTimeoutMs);

  // The frame's origin is opaque, so no target origin can name it; the
  // channel stays bound to this frame by its window and its key. The
  // sandbox's headers and the host's exact `frame-src` keep the frame from
  // navigating elsewhere.
  const send = (message: StateMessage | DataMessage) =>
    frame.contentWindow?.postMessage(message, '*');

  const sendState = (state: FrameState) =>
    send({ k: key, type: 'state', state: stateForGrant(state, granted) });

  const sendData = (binding: string, data: BindingData) => {
    if (delivered.get(binding) === data) return;
    send({ k: key, type: 'data', binding, data });
    delivered.set(binding, data);
    deliveredValues.delete(binding);
  };

  const refuse = (message: string) => onError({ source: 'host', message });

  const valuesDelivered = (
    binding: string,
    dimension: string,
  ): ReadonlySet<unknown> | undefined => {
    const data = delivered.get(binding);
    if (!data) return undefined;
    const byDimension =
      deliveredValues.get(binding) ?? new Map<string, ReadonlySet<unknown>>();
    deliveredValues.set(binding, byDimension);
    let values = byDimension.get(dimension);
    if (!values) {
      values = new Set(
        data.rows
          .filter(row => hasOwn(row, dimension))
          .map(row => row[dimension]),
      );
      byDimension.set(dimension, values);
    }
    return values;
  };

  const crossFilterProblem = (
    value: DataEventValue | null,
  ): string | undefined => {
    if (value === null) return undefined;
    if (value.values.length > caps.crossFilterValues) {
      return `a cross-filter carries at most ${caps.crossFilterValues} values`;
    }
    const values = valuesDelivered(value.binding, value.dimension);
    if (!values) return `no data was delivered for "${value.binding}"`;
    if (!value.values.every(candidate => values.has(candidate))) {
      return (
        `its values must come from the "${value.dimension}" values ` +
        `delivered for "${value.binding}"`
      );
    }
    return undefined;
  };

  const queryProblem = (request: FrameRequest): string | undefined => {
    const refreshCost = isCount(refreshQueries)
      ? refreshQueries
      : delivered.size;
    const cost = request.type === 'refresh' ? Math.max(1, refreshCost) : 1;
    if (queries + cost > caps.queries) {
      return `this frame may run at most ${caps.queries} queries`;
    }
    queries += cost;
    return undefined;
  };

  /** Whether a request fits the rate limit; refusals are reported once a burst. */
  const admit = (): boolean => {
    const now = Date.now();
    arrivals = arrivals.filter(time => now - time < 1000);
    if (arrivals.length >= caps.requestsPerSecond) {
      if (!throttled) {
        refuse(`refused requests over ${caps.requestsPerSecond} a second`);
      }
      throttled = true;
      return false;
    }
    throttled = false;
    arrivals.push(now);
    return true;
  };

  const handleRequest = (request: FrameRequest) => {
    const capability = REQUEST_CAPABILITY[request.type];
    if (!granted.has(capability)) {
      refuse(
        `refused ${request.type}: it needs the "${capability}" capability, ` +
          'which this frame was not granted',
      );
      return;
    }
    const problem =
      request.type === 'setCrossFilter'
        ? crossFilterProblem(request.value)
        : queryProblem(request);
    if (problem) {
      refuse(`refused ${request.type}: ${problem}`);
      return;
    }
    onRequest(request);
  };

  const onMessage = (event: MessageEvent) => {
    const { contentWindow } = frame;
    if (disposed || !contentWindow || event.source !== contentWindow) return;
    const message = parseFrameMessage(event.data);
    if (!message || message.k !== key) return;
    if (message.type === 'ready') {
      globalThis.clearTimeout(handshakeTimer);
      ready =
        message.protocol === PROTOCOL_NAME &&
        message.version === PROTOCOL_VERSION;
      if (!ready) {
        refuse(
          `the frame speaks ${message.protocol} ${message.version}; this ` +
            `host speaks ${PROTOCOL_NAME} ${PROTOCOL_VERSION}`,
        );
        return;
      }
      // Data first, so that a state saying `ok` finds it in place.
      held.forEach((data, binding) => sendData(binding, data));
      held.clear();
      if (latest) sendState(latest);
    } else if (message.type === 'error') {
      // TODO: decide which frame errors may reach an agent.
      onError({
        source: 'frame',
        kind: message.kind,
        message: message.message,
        ...(message.stack === undefined ? {} : { stack: message.stack }),
      });
    } else if (admit()) {
      if (ready) handleRequest(message.request);
      else refuse(`refused ${message.request.type}: the frame is not ready`);
    }
  };

  host.addEventListener('message', onMessage);

  return {
    name,
    postState(state: FrameState) {
      if (disposed) return;
      latest = state;
      if (ready) sendState(state);
    },
    postData(binding: string, data: BindingData) {
      if (disposed || !granted.has(Capability.DATA)) return;
      if (ready) sendData(binding, data);
      else held.set(binding, data);
    },
    dispose() {
      disposed = true;
      globalThis.clearTimeout(handshakeTimer);
      latest = undefined;
      held.clear();
      delivered.clear();
      deliveredValues.clear();
      host.removeEventListener('message', onMessage);
    },
  };
}
