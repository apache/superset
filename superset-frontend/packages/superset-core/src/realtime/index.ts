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
 * @fileoverview Realtime namespace for Superset extensions.
 *
 * Superset can push a short "this entity changed" nudge to every signed-in
 * browser over its realtime transport (the `superset-websocket` server, where
 * the deployment turns on `WEBSOCKET_ENABLE`). A nudge names the entity and
 * nothing else: a listener fetches it again through its own authorized API,
 * which decides what this viewer may see. Nudges are best-effort and are not
 * replayed, so a listener also fetches again when the transport reconnects.
 * Where the transport is off, neither event fires, and a page keeps what it
 * loaded until it loads again.
 *
 * The backend side is `superset_core.realtime.publish_entity_changed`.
 *
 * @example
 * ```typescript
 * import { realtime } from '@apache-superset/core';
 *
 * const changes = realtime.onDidChangeEntity(change => {
 *   if (change.entityType === 'widget' && change.id === widgetId) refetch();
 * });
 * const reconnects = realtime.onDidReconnect(refetch);
 * // Later:
 * changes.dispose();
 * reconnects.dispose();
 * ```
 */

import { Event } from '../common';

/** An entity the server says changed: what it is and its id, nothing more. */
export interface EntityChange {
  /** The kind of entity, such as `canvas`, `task` or `widget`. */
  entityType: string;
  /** Its id, as its publisher names it: an integer id or a UUID. */
  id: number | string;
}

/**
 * Fires for every entity change the server announces, whatever its type:
 * filter for the entities the page shows. The first subscription connects
 * the realtime transport where the deployment has it on.
 */
export declare const onDidChangeEntity: Event<EntityChange>;

/**
 * Fires when the realtime transport connects again after it dropped, during
 * which nudges may have been missed: fetch again what the page shows.
 */
export declare const onDidReconnect: Event<void>;
