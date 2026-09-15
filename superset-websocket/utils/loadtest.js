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
import Redis from 'ioredis';
import config from '../config.json' with { type: 'json' };
import { randomUUID } from 'crypto';

const redis = new Redis(config.redis);

const numClients = 256;

// The single Pub/Sub channel the server tails, mirrored from
// superset-websocket/src/index.ts: `<REALTIME_CHANNEL_PREFIX>realtime`. Resolve
// the prefix the same way the server does (env override, else config.json, else
// empty) so a loadtest points at a prefixed server's channel. Every
// browser-bound message rides this channel as a self-describing
// `{topic, scope, routes, payload}` envelope.
const realtimeChannelPrefix =
  process.env.REALTIME_CHANNEL_PREFIX || config.realtimeChannelPrefix || '';
const realtimeChannel = `${realtimeChannelPrefix}realtime`;

let entityId = 0;

function pushData() {
  const taskId = randomUUID();
  entityId += 1;

  // Broadcast entity-change nudge (scope `authenticated_global`), carrying only
  // opaque ids; forwarded to every authenticated socket.
  redis.publish(
    realtimeChannel,
    JSON.stringify({
      topic: 'entity.changed',
      scope: 'authenticated_global',
      payload: { entity_type: 'task', id: entityId },
    }),
  );

  // Targeted task-status message per simulated client (scope `principal`), each
  // routed by the server to that principal's sockets only. Routing keys use the
  // principal-channel format (`user:<id>`) from superset.tasks.subscription.
  for (let i = 0; i < numClients; i++) {
    redis.publish(
      realtimeChannel,
      JSON.stringify({
        topic: 'task.status',
        scope: 'principal',
        routes: [`user:${i}`],
        payload: { task_id: taskId, status: 'running' },
      }),
    );
  }
}

pushData();
setInterval(pushData, 1000);
