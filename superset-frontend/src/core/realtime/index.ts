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
 * @fileoverview Host-internal implementation of the `realtime` namespace.
 *
 * Extensions get the host's shared realtime socket (`src/middleware/realtime`)
 * as two events: the `entity.changed` nudges, with the wire payload turned
 * into an {@link realtimeApi.EntityChange}, and the socket's reconnects. The
 * middleware isolates each handler, so a listener that throws stops no other.
 */

import type { realtime as realtimeApi } from '@apache-superset/core';
import {
  subscribeRealtime,
  subscribeRealtimeOpen,
} from 'src/middleware/realtime';
import { Disposable } from '../models';

type EntityChange = realtimeApi.EntityChange;

export const ENTITY_CHANGED_TOPIC = 'entity.changed';

/** The change a nudge's payload names, or `undefined` for a malformed one. */
export const entityChangeOf = (payload: unknown): EntityChange | undefined => {
  if (!payload || typeof payload !== 'object') return undefined;
  const { entity_type: entityType, id } = payload as {
    entity_type?: unknown;
    id?: unknown;
  };
  if (typeof entityType !== 'string' || entityType === '') return undefined;
  if (typeof id === 'number' && Number.isFinite(id)) return { entityType, id };
  if (typeof id === 'string' && id !== '') return { entityType, id };
  return undefined;
};

const onDidChangeEntity: typeof realtimeApi.onDidChangeEntity = (
  listener: (change: EntityChange) => void,
  thisArgs?: unknown,
): Disposable => {
  const bound = thisArgs ? listener.bind(thisArgs) : listener;
  const unsubscribe = subscribeRealtime(ENTITY_CHANGED_TOPIC, payload => {
    const change = entityChangeOf(payload);
    if (change) bound(change);
  });
  return new Disposable(unsubscribe);
};

// Only a reconnect can have lost a broadcast: a `rebind` moves the tab's own
// channel, which carries no `entity.changed` nudge.
const onDidReconnect: typeof realtimeApi.onDidReconnect = (
  listener: () => void,
  thisArgs?: unknown,
): Disposable => {
  const bound = thisArgs ? listener.bind(thisArgs) : listener;
  const unsubscribe = subscribeRealtimeOpen(reason => {
    if (reason === 'reconnect') bound();
  });
  return new Disposable(unsubscribe);
};

export const realtime: typeof realtimeApi = {
  onDidChangeEntity,
  onDidReconnect,
};
