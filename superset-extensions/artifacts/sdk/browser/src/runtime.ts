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
 * @fileoverview The in-frame runtime: `window.superset`, as artifact code
 * sees it.
 *
 * The sandbox page runs `installRuntime()` before any artifact code. It reads
 * its channel config from `window.name`, takes state only from the parent
 * window with the right key, and posts requests and errors to the host's
 * origin. Each method checks the capability grant and throws a
 * `CapabilityError` without it. That check is a courtesy to the artifact's
 * author: the host enforces the grant again, authoritatively, because the
 * code in the frame is untrusted.
 *
 * Results never come back from a request directly: every change, including
 * the result of a `query`, arrives as new state through `onData`.
 */

import { Capability } from './capabilities';
import {
  ArtifactFilter,
  ArtifactTheme,
  BindingData,
  DataEventValue,
  FrameErrorKind,
  FrameMessage,
  FrameRequest,
  FrameState,
  FrameStatus,
  parseFrameConfig,
  parseFrameRequest,
  parseHostMessage,
  PROTOCOL_NAME,
  PROTOCOL_VERSION,
  REQUEST_CAPABILITY,
} from './protocol';

/** Thrown by a `window.superset` method that the grant doesn't cover. */
export class CapabilityError extends Error {
  readonly capability: Capability;

  constructor(method: string, capability: Capability) {
    super(
      `superset.${method}() needs the "${capability}" capability, which ` +
        'this artifact was not granted. Declare it in the "capabilities" ' +
        'of manifest.json; a host may still withhold it in some contexts.',
    );
    this.name = 'CapabilityError';
    this.capability = capability;
  }
}

export type StateListener = (state: FrameState) => void;

/** `window.superset`: what the artifact's code calls. */
export interface SupersetRuntime {
  /** The capabilities this frame was granted. */
  readonly capabilities: readonly Capability[];
  /**
   * Call `listener` with the latest state at once, then on every change.
   * Returns a function that unsubscribes it.
   */
  onData(listener: StateListener): () => void;
  /** The latest result of a named binding. Needs `data`. */
  data(name: string): BindingData | undefined;
  /** The filters whose scope includes the artifact. Needs `data`. */
  filters(): ArtifactFilter[];
  /** The canvas theme. Needs `theme`. */
  theme(): ArtifactTheme | undefined;
  /** Whether the bindings are loading, loaded or failed. */
  status(): FrameStatus;
  /**
   * Ask the host to rerun a binding with new values for its declared
   * parameters; the result arrives through `onData`. Needs `data`.
   */
  query(name: string, params?: Record<string, unknown>): void;
  /**
   * Set a cross-filter on a declared event, or clear it with `null`. Needs
   * `cross_filter`.
   */
  setCrossFilter(value: DataEventValue | null): void;
  /**
   * Ask the host to run the bindings again, fresh from the warehouse. Needs
   * `data`.
   */
  refresh(): void;
}

const DISCONNECTED = 'the artifact runtime has no connection to a host';

const installed = new WeakMap<Window, SupersetRuntime>();

function errorDetails(reason: unknown): { message: string; stack?: string } {
  if (reason instanceof Error) {
    return typeof reason.stack === 'string'
      ? { message: reason.message, stack: reason.stack }
      : { message: reason.message };
  }
  try {
    return { message: String(reason) };
  } catch {
    return { message: 'Unknown error' };
  }
}

/**
 * Install `window.superset` in this frame, and return it.
 *
 * Without a valid config in `window.name` the runtime stays disconnected:
 * its status is `error`, it posts nothing, and every guarded method throws.
 * Installing again in the same window returns the same runtime.
 */
export function installRuntime(win: Window = window): SupersetRuntime {
  const existing = installed.get(win);
  if (existing) return existing;

  const config = parseFrameConfig(win.name);
  // The key is the channel's secret: clear it, so that a later document in
  // this frame can't read it.
  win.name = '';
  const { parent } = win;
  const granted = new Set<Capability>(config ? config.grant : []);
  let state: FrameState = config
    ? { status: 'loading', bindings: {}, filters: [] }
    : { status: 'error', bindings: {}, filters: [], error: DISCONNECTED };
  let listeners: StateListener[] = [];

  const post = (message: FrameMessage) => {
    if (config) parent.postMessage(message, config.origin);
  };

  const report = (kind: FrameErrorKind, reason: unknown) => {
    if (!config) return;
    try {
      post({ k: config.k, type: 'error', kind, ...errorDetails(reason) });
    } catch {
      // Reporting an error must never throw another.
    }
  };

  const notify = (listener: StateListener) => {
    try {
      listener(state);
    } catch (error) {
      report('callback', error);
    }
  };

  const need = (capability: Capability, method: string) => {
    if (!config) throw new Error(`superset.${method}(): ${DISCONNECTED}`);
    if (!granted.has(capability)) throw new CapabilityError(method, capability);
  };

  // Each request method is named after its request type, and needs the
  // capability that REQUEST_CAPABILITY gives the type, the table the host
  // enforces. Posts the validated copy, so only the fields the protocol
  // defines leave the frame.
  const send = (request: FrameRequest, expected: string) => {
    const method = request.type;
    need(REQUEST_CAPABILITY[method], method);
    const parsed = parseFrameRequest(request);
    if (!parsed)
      throw new TypeError(`superset.${method}() expects ${expected}`);
    if (config) post({ k: config.k, type: 'request', request: parsed });
  };

  const onMessage = (event: MessageEvent) => {
    if (!config || event.source !== parent) return;
    const message = parseHostMessage(event.data);
    if (!message || message.k !== config.k) return;
    ({ state } = message);
    listeners.forEach(notify);
  };

  const runtime: SupersetRuntime = Object.freeze({
    capabilities: Object.freeze([...granted]),
    onData(listener: StateListener) {
      listeners = [...listeners, listener];
      notify(listener);
      return () => {
        listeners = listeners.filter(candidate => candidate !== listener);
      };
    },
    data(name: string) {
      need(Capability.DATA, 'data');
      return Object.prototype.hasOwnProperty.call(state.bindings, name)
        ? state.bindings[name]
        : undefined;
    },
    filters() {
      need(Capability.DATA, 'filters');
      return state.filters;
    },
    theme() {
      need(Capability.THEME, 'theme');
      return state.theme;
    },
    status: () => state.status,
    query(name: string, params: Record<string, unknown> = {}) {
      send(
        { type: 'query', binding: name, params },
        'a binding name and an object of parameter values',
      );
    },
    setCrossFilter(value: DataEventValue | null) {
      send(
        { type: 'setCrossFilter', value },
        '{ binding, dimension, values } or null',
      );
    },
    refresh() {
      send({ type: 'refresh' }, 'no arguments');
    },
  });

  win.addEventListener('message', onMessage);
  win.addEventListener('error', (event: ErrorEvent) =>
    report('error', event.error ?? event.message),
  );
  win.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) =>
    report('unhandledrejection', event.reason),
  );
  Object.defineProperty(win, 'superset', {
    value: runtime,
    configurable: true,
    enumerable: true,
    writable: false,
  });
  installed.set(win, runtime);
  if (config) {
    post({
      k: config.k,
      type: 'ready',
      protocol: PROTOCOL_NAME,
      version: PROTOCOL_VERSION,
    });
  }
  return runtime;
}
