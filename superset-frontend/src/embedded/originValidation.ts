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

// The message type used for the embedded comms handshake. Must stay in sync
// with the parent SDK's handshake messages.
export const MESSAGE_TYPE = '__embedded_comms__';

/**
 * Normalizes an allowed-domain entry to its origin (`scheme://host[:port]`),
 * matching the comparison the backend performs via `flask_wtf.csrf.same_origin`.
 *
 * A browser-provided `event.origin` never carries a path or trailing slash, but
 * configured allowed domains may (e.g. `https://example.com/` or
 * `https://app.example.com/embed`). Reducing each entry to its origin keeps the
 * frontend and backend in agreement about what an "allowed domain" is. Entries
 * that cannot be parsed as a URL fall back to the raw value so an exact match is
 * still possible.
 */
function normalizeToOrigin(domain: string): string {
  try {
    return new URL(domain).origin;
  } catch {
    return domain;
  }
}

/**
 * Validates the origin of an incoming postMessage event against the dashboard's
 * configured allowed domains.
 *
 * Enforcement is opt-in by configuration: if the allowed-domains list is empty
 * or undefined, any origin is accepted (no restriction), which preserves the
 * historical behavior for embeds that did not configure domains. When the list
 * is non-empty, only origins present in the list are accepted.
 */
export function isMessageOriginAllowed(
  origin: string,
  allowedDomains?: string[],
): boolean {
  if (!allowedDomains || allowedDomains.length === 0) {
    return true;
  }
  if (allowedDomains.some(domain => normalizeToOrigin(domain) === origin)) {
    return true;
  }
  // eslint-disable-next-line no-console
  console.warn(
    `[superset] ignoring embedded message from origin "${origin}" which is not in the list of allowed domains`,
  );
  return false;
}

/**
 * Validates that an incoming message is intended for embedded comms and that it
 * originates from an allowed domain. Returns `true` when the message should be
 * processed, `false` otherwise.
 */
export function validateMessageEvent(
  event: MessageEvent,
  allowedDomains?: string[],
): boolean {
  if (!isMessageOriginAllowed(event.origin, allowedDomains)) {
    return false;
  }

  if (
    typeof event.data !== 'object' ||
    event.data === null ||
    event.data.type !== MESSAGE_TYPE
  ) {
    return false;
  }

  return true;
}
