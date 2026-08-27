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
const Redis = require('ioredis');
const config = require('../config.json');
const { randomUUID } = require('crypto');
const redis = new Redis(config.redis);

const numClients = 256;

// The Pub/Sub channels the server tails; a fixed wire-protocol contract with the
// Superset producer, mirrored from superset-websocket/src/index.ts.
const entityChangesChannel = 'entity-changes:task';
const taskStatusChannel = 'task-status';

function pushData() {
  const taskId = randomUUID();

  // Tier 1: one broadcast entity-change nudge, carrying only opaque ids.
  redis.publish(
    entityChangesChannel,
    JSON.stringify({ entity_type: 'task', id: taskId }),
  );

  // Tier 2: one targeted task-status message per simulated client, each fanned
  // out by the server to that principal's sockets only.
  for (let i = 0; i < numClients; i++) {
    redis.publish(
      taskStatusChannel,
      JSON.stringify({
        task_id: taskId,
        status: 'running',
        subscribers: [{ principal_type: 'user', sub: String(i) }],
      }),
    );
  }
}

pushData();
setInterval(pushData, 1000);
