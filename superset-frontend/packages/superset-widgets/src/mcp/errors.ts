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
import { t } from '@apache-superset/core/translation';

/**
 * Codes a connector call can fail with (the artifact runtime's own codes),
 * plus the client's: `capability_unavailable` (not inside an artifact that
 * may use connectors), `unsupported` (the chosen strategy cannot serve this
 * widget) and `invalid_response` (the tool answered with something unreadable).
 */
export type WidgetMcpErrorCode =
  | 'needs_reauth'
  | 'server_not_connected'
  | 'server_not_found'
  | 'selection_required'
  | 'server_unavailable'
  | 'not_in_manifest'
  | 'blocked_by_policy'
  | 'approval_required'
  | 'consent_required'
  | 'not_granted'
  | 'tool_error'
  | 'bad_request'
  | 'cancelled'
  | 'rate_limited'
  | 'upstream_error'
  | 'capability_disabled'
  | 'capability_removed'
  | 'transform_error'
  | 'user_changed'
  | 'capability_unavailable'
  | 'unsupported'
  | 'invalid_response'
  | 'not_found'
  | 'forbidden'
  | 'invalid_widget';

export class WidgetMcpError extends Error {
  readonly code: WidgetMcpErrorCode;

  readonly server?: string;

  /** Only set when repeating the call unattended may succeed. */
  readonly retryable: boolean;

  readonly retryAfterMs?: number;

  constructor(
    code: WidgetMcpErrorCode,
    message: string,
    options: {
      server?: string;
      retryable?: boolean;
      retryAfterMs?: number;
    } = {},
  ) {
    super(message);
    this.name = 'WidgetMcpError';
    this.code = code;
    this.server = options.server;
    this.retryable = options.retryable ?? false;
    this.retryAfterMs = options.retryAfterMs;
  }
}

const KNOWN_CODES = new Set<string>([
  'needs_reauth',
  'server_not_connected',
  'server_not_found',
  'selection_required',
  'server_unavailable',
  'not_in_manifest',
  'blocked_by_policy',
  'approval_required',
  'consent_required',
  'not_granted',
  'tool_error',
  'bad_request',
  'cancelled',
  'rate_limited',
  'upstream_error',
  'capability_disabled',
  'capability_removed',
  'transform_error',
  'user_changed',
]);

/** What the viewer can do about each failure; one message per distinct fix. */
function viewerMessage(
  code: WidgetMcpErrorCode,
  server: string,
  detail: string,
): string {
  switch (code) {
    case 'needs_reauth':
      return t(
        'Reconnect the %s connector in Claude settings, then reload this page.',
        server,
      );
    case 'server_not_connected':
    case 'server_not_found':
      return t(
        'Add the %s connector in Claude settings to see this data.',
        server,
      );
    case 'selection_required':
      return t('Choose which %s connector this page should use.', server);
    case 'not_in_manifest':
      return t(
        'This page is not allowed to call %s. Republish it with the connector in its manifest.',
        server,
      );
    case 'approval_required':
    case 'consent_required':
    case 'not_granted':
      return t('Approve access to %s to load this widget.', server);
    case 'blocked_by_policy':
      return t("Your organization's policy blocks %s on this page.", server);
    case 'server_unavailable':
    case 'upstream_error':
    case 'rate_limited':
      return t('%s is not responding right now. Try again shortly.', server);
    case 'cancelled':
      return t('The request was cancelled.');
    case 'capability_disabled':
    case 'capability_removed':
    case 'user_changed':
      return t('Connector access for this page changed. Reload the page.');
    case 'transform_error':
    case 'invalid_response':
      return t('Could not read the response from %s.', server);
    case 'capability_unavailable':
      return t(
        'Superset widgets need to run inside a Claude artifact with the %s connector.',
        server,
      );
    case 'not_found':
      return detail
        ? t('Not found in %s: %s', server, detail)
        : t('This widget or its dataset was not found in %s.', server);
    case 'forbidden':
      return t('Your %s account does not have access to this data.', server);
    case 'invalid_widget':
      return detail
        ? t('%s rejected this widget definition: %s', server, detail)
        : t('%s rejected this widget definition.', server);
    case 'bad_request':
    case 'tool_error':
    case 'unsupported':
    default:
      return detail || t('%s could not load this widget.', server);
  }
}

/** A rejection from `callTool` (or anything thrown around it) as a typed error. */
export function toWidgetMcpError(
  error: unknown,
  server: string,
): WidgetMcpError {
  if (error instanceof WidgetMcpError) return error;
  const raw = (error ?? {}) as {
    code?: unknown;
    message?: unknown;
    retryable?: unknown;
    retryAfterMs?: unknown;
  };
  const code: WidgetMcpErrorCode =
    typeof raw.code === 'string' && KNOWN_CODES.has(raw.code)
      ? (raw.code as WidgetMcpErrorCode)
      : 'upstream_error';
  const detail = typeof raw.message === 'string' ? raw.message : '';
  return new WidgetMcpError(code, viewerMessage(code, server, detail), {
    server,
    retryable: raw.retryable === true,
    retryAfterMs:
      typeof raw.retryAfterMs === 'number' ? raw.retryAfterMs : undefined,
  });
}

/** A client-side failure (`unsupported`, `invalid_response`, ...) with the viewer-facing message. */
export function widgetMcpError(
  code: WidgetMcpErrorCode,
  server: string,
  detail = '',
): WidgetMcpError {
  return new WidgetMcpError(code, viewerMessage(code, server, detail), {
    server,
  });
}

/**
 * Superset's MCP tools report failures in-band, as a normal result shaped
 * `{error, error_type, errors?}`; `null` when `payload` is data.
 */
export function toolErrorFromPayload(
  payload: unknown,
  server: string,
): WidgetMcpError | null {
  if (typeof payload !== 'object' || payload === null) return null;
  const {
    error,
    error_type: errorType,
    errors,
  } = payload as {
    error?: unknown;
    error_type?: unknown;
    errors?: unknown;
  };
  if (typeof error !== 'string' && typeof errorType !== 'string') return null;

  const details = Array.isArray(errors)
    ? errors
        .map(item =>
          typeof item === 'string'
            ? item
            : typeof (item as { message?: unknown })?.message === 'string'
              ? (item as { message: string }).message
              : '',
        )
        .filter(Boolean)
    : [];
  const detail = [typeof error === 'string' ? error : '', ...details]
    .filter(Boolean)
    .join('; ');

  const code: WidgetMcpErrorCode =
    errorType === 'NotFound'
      ? 'not_found'
      : errorType === 'Forbidden'
        ? 'forbidden'
        : errorType === 'ValidationError'
          ? 'invalid_widget'
          : 'tool_error';
  return widgetMcpError(code, server, detail);
}
