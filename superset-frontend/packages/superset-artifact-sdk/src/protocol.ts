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
 * @fileoverview The bridge protocol between an artifact's frame and its host.
 * Mirrors `superset_core.artifacts.protocol`.
 *
 * The frame runs untrusted code on an opaque origin with no network; the host
 * is the Superset page around it, and they talk only through `postMessage`.
 * Every message carries the channel key `k`. The host makes a key per frame
 * and passes it, with the capability grant and its own origin, in the
 * iframe's `name` (see {@link FrameConfig}); each side drops messages from
 * any other window or with any other key.
 *
 * - Host to frame: `state`, everything the frame may know.
 * - Frame to host: `ready` (the versioned handshake), `request` (`query`,
 *   `setCrossFilter`, `emit`, `refresh`) and `error`.
 *
 * The parsers here validate a message and return a clean copy holding only
 * the fields the protocol defines; the type guards wrap them.
 */

// Review finding M5 (pending): adopt the MCP Apps protocol and SDK after a
// spike. M9, M10 (pending): MCP Apps names for theme variables and CSP
// settings. K15 (pending): an Arrow envelope for binding data.

import { Capability, isCapability } from './capabilities';
import type { EventKind } from './manifest';

export const PROTOCOL_NAME = 'superset-artifacts';
export const PROTOCOL_VERSION = 1;

/** A single value in a data event. */
export type Scalar = string | number | boolean | null;

export type DataRow = Record<string, unknown>;

export interface ColumnInfo {
  name: string;
  /** The column's generic type, such as `STRING`, `NUMERIC` or `TEMPORAL`. */
  type?: string;
  label?: string;
}

/** How a metric or dimension is defined and formatted, as Superset has it. */
export interface FieldDefinition {
  kind?: 'metric' | 'dimension';
  label?: string;
  /** A metric's expression, such as `SUM(revenue)`. */
  expression?: string;
  /** A number or date format, such as `$,.2f`. */
  format?: string;
  description?: string;
}

/** One binding's result, run on the server as the viewer. */
export interface BindingData {
  rows: DataRow[];
  columns?: ColumnInfo[];
  /** Keyed by metric or dimension name. */
  definitions?: Record<string, FieldDefinition>;
}

/** A filter whose scope includes the artifact. */
export interface ArtifactFilter {
  /** A canvas filter, or another widget's cross-filter. */
  kind: 'filter' | 'cross_filter';
  /** The canvas node that set it. */
  source: string;
  /** Its value, in the format of the widget that set it. */
  value: unknown;
}

export interface ArtifactTheme {
  mode: 'light' | 'dark';
  /** Theme tokens by name. */
  tokens: Record<string, string | number>;
}

export type FrameStatus = 'loading' | 'ok' | 'error';

/**
 * Everything the frame may know. The host leaves out what the grant doesn't
 * cover: `bindings` and `filters` need `data`, `theme` needs `theme`.
 */
export interface FrameState {
  status: FrameStatus;
  /** Keyed by binding name. */
  bindings: Record<string, BindingData>;
  filters: ArtifactFilter[];
  theme?: ArtifactTheme;
  /** Why the bindings failed, when `status` is `error`. */
  error?: string;
}

/** What a data event carries: values of one dimension of one binding. */
export interface DataEventValue {
  binding: string;
  dimension: string;
  values: Scalar[];
}

/** The event kinds `emit` sends; cross-filters go through `setCrossFilter`. */
export type EmittedEventKind = Exclude<EventKind, 'cross_filter'>;

export const EMITTED_EVENT_KINDS: readonly EmittedEventKind[] = Object.freeze([
  'selection',
  'highlight',
  'drill',
]);

/** Rerun a binding with new values for its declared parameters. */
export interface QueryRequest {
  type: 'query';
  binding: string;
  params: Record<string, unknown>;
}

/** Set a cross-filter on a declared event, or clear it with `null`. */
export interface SetCrossFilterRequest {
  type: 'setCrossFilter';
  value: DataEventValue | null;
}

/** Emit a declared data event, or clear it with `null`. */
export interface EmitRequest {
  type: 'emit';
  kind: EmittedEventKind;
  value: DataEventValue | null;
}

/** Run the bindings again. */
export interface RefreshRequest {
  type: 'refresh';
}

export type FrameRequest =
  | QueryRequest
  | SetCrossFilterRequest
  | EmitRequest
  | RefreshRequest;

export type FrameRequestType = FrameRequest['type'];

type RequestCapabilities = Readonly<Record<FrameRequestType, Capability>>;

/** The capability each request needs. */
export const REQUEST_CAPABILITY: RequestCapabilities = Object.freeze({
  query: Capability.DATA,
  setCrossFilter: Capability.CROSS_FILTER,
  emit: Capability.EVENTS,
  refresh: Capability.REFRESH,
});

/** How an error surfaced in the frame. */
export type FrameErrorKind = 'error' | 'unhandledrejection' | 'callback';

/** Host to frame: the frame's state, sent whenever it changes. */
export interface StateMessage {
  k: string;
  type: 'state';
  state: FrameState;
}

/** Frame to host: the runtime is listening, and speaks this protocol. */
export interface ReadyMessage {
  k: string;
  type: 'ready';
  protocol: string;
  version: number;
}

/** Frame to host: a request, which the host checks before acting. */
export interface RequestMessage {
  k: string;
  type: 'request';
  request: FrameRequest;
}

/** Frame to host: an error in the artifact, for its author. */
export interface ErrorMessage {
  k: string;
  type: 'error';
  kind: FrameErrorKind;
  message: string;
  stack?: string;
}

export type HostMessage = StateMessage;
export type FrameMessage = ReadyMessage | RequestMessage | ErrorMessage;

/**
 * What the host passes to the frame as the iframe's `name`, in JSON: the
 * channel key, the capability grant and the host's origin, which the frame
 * posts to.
 */
export interface FrameConfig {
  k: string;
  usable: Capability[];
  origin: string;
}

const ORIGIN = /^[a-z][a-z0-9+.-]*:\/\/[^/?#\s]+$/i;
const FRAME_STATUSES: readonly string[] = ['loading', 'ok', 'error'];
const FRAME_ERROR_KINDS: readonly string[] = [
  'error',
  'unhandledrejection',
  'callback',
];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0;

const isScalar = (value: unknown): value is Scalar =>
  value === null ||
  typeof value === 'string' ||
  typeof value === 'boolean' ||
  (typeof value === 'number' && Number.isFinite(value));

const isEmittedEventKind = (value: unknown): value is EmittedEventKind =>
  (EMITTED_EVENT_KINDS as readonly unknown[]).includes(value);

const isFrameErrorKind = (value: unknown): value is FrameErrorKind =>
  typeof value === 'string' && FRAME_ERROR_KINDS.includes(value);

const isFrameStatus = (value: unknown): value is FrameStatus =>
  typeof value === 'string' && FRAME_STATUSES.includes(value);

const isEventValue = (value: unknown): value is DataEventValue =>
  isRecord(value) &&
  isNonEmptyString(value.binding) &&
  isNonEmptyString(value.dimension) &&
  Array.isArray(value.values) &&
  value.values.every(isScalar);

const copyEventValue = (value: DataEventValue | null): DataEventValue | null =>
  value === null
    ? null
    : {
        binding: value.binding,
        dimension: value.dimension,
        values: [...value.values],
      };

const isColumnInfo = (value: unknown): boolean =>
  isRecord(value) && typeof value.name === 'string';

const isBindingData = (value: unknown): value is BindingData =>
  isRecord(value) &&
  Array.isArray(value.rows) &&
  value.rows.every(isRecord) &&
  (value.columns === undefined ||
    (Array.isArray(value.columns) && value.columns.every(isColumnInfo))) &&
  (value.definitions === undefined ||
    (isRecord(value.definitions) &&
      Object.values(value.definitions).every(isRecord)));

const isArtifactFilter = (value: unknown): value is ArtifactFilter =>
  isRecord(value) &&
  (value.kind === 'filter' || value.kind === 'cross_filter') &&
  typeof value.source === 'string';

const isArtifactTheme = (value: unknown): value is ArtifactTheme =>
  isRecord(value) &&
  (value.mode === 'light' || value.mode === 'dark') &&
  isRecord(value.tokens);

/** Validate a frame request; return a copy without unknown fields. */
export function parseFrameRequest(value: unknown): FrameRequest | undefined {
  if (!isRecord(value)) return undefined;
  const { binding, kind, params, value: event } = value;
  const validEvent = event === null || isEventValue(event);
  switch (value.type) {
    case 'query':
      return isNonEmptyString(binding) && isRecord(params)
        ? { type: 'query', binding, params: { ...params } }
        : undefined;
    case 'setCrossFilter':
      return validEvent
        ? { type: 'setCrossFilter', value: copyEventValue(event) }
        : undefined;
    case 'emit':
      return validEvent && isEmittedEventKind(kind)
        ? { type: 'emit', kind, value: copyEventValue(event) }
        : undefined;
    case 'refresh':
      return { type: 'refresh' };
    default:
      return undefined;
  }
}

/** Validate a frame-to-host message; return a copy without unknown fields. */
export function parseFrameMessage(data: unknown): FrameMessage | undefined {
  if (!isRecord(data)) return undefined;
  const { k, kind, message, protocol, stack, version } = data;
  if (!isNonEmptyString(k)) return undefined;
  switch (data.type) {
    case 'ready':
      return typeof protocol === 'string' &&
        typeof version === 'number' &&
        Number.isInteger(version)
        ? { k, type: 'ready', protocol, version }
        : undefined;
    case 'request': {
      const request = parseFrameRequest(data.request);
      return request && { k, type: 'request', request };
    }
    case 'error':
      if (
        !isFrameErrorKind(kind) ||
        typeof message !== 'string' ||
        (stack !== undefined && typeof stack !== 'string')
      ) {
        return undefined;
      }
      return {
        k,
        type: 'error',
        kind,
        message,
        ...(typeof stack === 'string' ? { stack } : {}),
      };
    default:
      return undefined;
  }
}

/** Validate a host-to-frame message. */
export function parseHostMessage(data: unknown): HostMessage | undefined {
  if (!isRecord(data)) return undefined;
  const { k, state } = data;
  if (!isNonEmptyString(k) || data.type !== 'state') return undefined;
  if (
    !isRecord(state) ||
    !isFrameStatus(state.status) ||
    !isRecord(state.bindings) ||
    !Object.values(state.bindings).every(isBindingData) ||
    !Array.isArray(state.filters) ||
    !state.filters.every(isArtifactFilter) ||
    (state.theme !== undefined && !isArtifactTheme(state.theme)) ||
    (state.error !== undefined && typeof state.error !== 'string')
  ) {
    return undefined;
  }
  return {
    k,
    type: 'state',
    state: {
      status: state.status,
      bindings: state.bindings as Record<string, BindingData>,
      filters: state.filters,
      ...(isArtifactTheme(state.theme) ? { theme: state.theme } : {}),
      ...(typeof state.error === 'string' ? { error: state.error } : {}),
    },
  };
}

export const isFrameRequest = (value: unknown): value is FrameRequest =>
  parseFrameRequest(value) !== undefined;

export const isFrameMessage = (data: unknown): data is FrameMessage =>
  parseFrameMessage(data) !== undefined;

export const isHostMessage = (data: unknown): data is HostMessage =>
  parseHostMessage(data) !== undefined;

/** Encode the frame's config as the value of the iframe's `name`. */
export const encodeFrameConfig = (config: FrameConfig): string =>
  JSON.stringify(config);

/**
 * Read the frame's config from `window.name`. Returns `undefined` unless it
 * has a key and a real origin to post to (never `*`); capabilities this SDK
 * doesn't know are dropped.
 */
export function parseFrameConfig(name: string): FrameConfig | undefined {
  let config: unknown;
  try {
    config = JSON.parse(name);
  } catch {
    return undefined;
  }
  if (
    !isRecord(config) ||
    !isNonEmptyString(config.k) ||
    !Array.isArray(config.usable) ||
    typeof config.origin !== 'string' ||
    !ORIGIN.test(config.origin)
  ) {
    return undefined;
  }
  return {
    k: config.k,
    usable: config.usable.filter(isCapability),
    origin: config.origin,
  };
}
