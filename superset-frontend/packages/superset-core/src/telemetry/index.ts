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
 * @fileoverview The `telemetry` contribution type: an extension reporting how
 * it is used.
 *
 * Events travel the same path as the host's own -- batched, sent to `/log/`,
 * recorded in the `logs` table -- which means they are already attributed to
 * whatever the user has open. An event raised while a canvas is on screen
 * carries that canvas without the extension doing anything.
 *
 * The host stamps the calling extension's id onto every event, so an event
 * cannot be attributed to another extension and cannot be sent anonymously.
 */

/**
 * The fields an event may carry.
 *
 * Scalars only, and flat. This is the privacy guardrail written into the type:
 * an extension has to reduce what happened into dimensions -- a count, a
 * duration, a category, a boolean -- rather than handing over a conversation
 * turn, a query result or a user's filter selections. Non-scalar values are
 * rejected by the host rather than stringified.
 */
export type TelemetryEventData = Record<
  string,
  string | number | boolean | null | undefined
>;

/**
 * Records that something happened.
 *
 * `name` identifies the event within the extension; the host prefixes it with
 * the extension's id, lower-cases it and strips anything outside `[a-z0-9_]`,
 * so the set of names stays bounded no matter what is passed.
 *
 * Telemetry is best-effort and never throws: an invalid name, an oversized
 * payload, or too many events in too short a window are dropped rather than
 * raised. Reporting must not be able to break the thing it reports on.
 *
 * @param name A short name, such as `message_sent`.
 * @param data Scalar dimensions describing the event.
 */
export declare function logEvent(name: string, data?: TelemetryEventData): void;
