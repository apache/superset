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
 * enforces the capability grant itself. This is the authoritative check: the
 * runtime in the frame checks too, but the frame runs untrusted code.
 *
 * @example
 * ```typescript
 * const channel = createFrameChannel({ frame, grant, onRequest, onError });
 * frame.name = channel.name; // before the frame loads
 * frame.src = frameLink; // a short-lived link from the provider
 * channel.postState(state);
 * ```
 */

import { Capability, isCapability } from './capabilities';
import {
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

export interface FrameChannelOptions {
  /** The artifact's iframe, sandboxed with `allow-scripts` only. */
  frame: HTMLIFrameElement;
  /** The capabilities granted to the frame in this context. */
  grant: readonly Capability[];
  /**
   * Called for each well-formed request that the grant allows. Check it
   * against the manifest (declared bindings, parameters and events) before
   * acting on it.
   */
  onRequest: (request: FrameRequest) => void;
  /** Called for the frame's errors, and for messages the host refused. */
  onError: (error: ChannelError) => void;
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
  /** Stop listening and drop any held state. */
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
  const data = granted.has(Capability.DATA);
  const theme = granted.has(Capability.THEME) ? state.theme : undefined;
  return {
    status: state.status,
    bindings: data ? state.bindings : {},
    filters: data ? state.filters : [],
    ...(theme === undefined ? {} : { theme }),
    ...(state.error === undefined ? {} : { error: state.error }),
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
  hostWindow,
}: FrameChannelOptions): FrameChannel {
  const host = hostWindow ?? window;
  const key = createChannelKey();
  const granted = new Set(grant.filter(isCapability));
  const name = encodeFrameConfig({
    k: key,
    grant: [...granted],
    origin: host.location.origin,
  });
  let latest: FrameState | undefined;
  let ready = false;
  let disposed = false;

  const post = (state: FrameState) => {
    const message: StateMessage = {
      k: key,
      type: 'state',
      state: stateForGrant(state, granted),
    };
    // The frame's origin is opaque, so no target origin can name it; the
    // channel stays bound to this frame by its window and its key. The
    // sandbox's headers and the host's exact `frame-src` keep the frame from
    // navigating elsewhere (DR-07).
    frame.contentWindow?.postMessage(message, '*');
  };

  const refuse = (message: string) => onError({ source: 'host', message });

  const handleRequest = (request: FrameRequest) => {
    const capability = REQUEST_CAPABILITY[request.type];
    if (!granted.has(capability)) {
      refuse(
        `refused ${request.type}: it needs the "${capability}" capability, ` +
          'which this frame was not granted',
      );
      return;
    }
    // TODO(T1): accept only cross-filter values the host delivered, and type
    // and rate-limit parameters; with S9, Canvas then applies events by scope.
    onRequest(request);
  };

  const onMessage = (event: MessageEvent) => {
    const { contentWindow } = frame;
    if (disposed || !contentWindow || event.source !== contentWindow) return;
    const message = parseFrameMessage(event.data);
    if (!message || message.k !== key) return;
    if (message.type === 'ready') {
      ready =
        message.protocol === PROTOCOL_NAME &&
        message.version === PROTOCOL_VERSION;
      if (!ready) {
        refuse(
          `the frame speaks ${message.protocol} ${message.version}; this ` +
            `host speaks ${PROTOCOL_NAME} ${PROTOCOL_VERSION}`,
        );
      } else if (latest) {
        post(latest);
      }
    } else if (message.type === 'error') {
      // TODO(T7, T9): decide which frame errors may reach an agent.
      onError({
        source: 'frame',
        kind: message.kind,
        message: message.message,
        ...(message.stack === undefined ? {} : { stack: message.stack }),
      });
    } else if (!ready) {
      refuse(`refused ${message.request.type}: the frame is not ready`);
    } else {
      handleRequest(message.request);
    }
  };

  host.addEventListener('message', onMessage);

  return {
    name,
    postState(state: FrameState) {
      if (disposed) return;
      latest = state;
      if (ready) post(state);
    },
    dispose() {
      disposed = true;
      latest = undefined;
      host.removeEventListener('message', onMessage);
    },
  };
}
