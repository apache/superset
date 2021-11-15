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
const { v4: uuidv4 } = require('uuid');
const Redis = require('ioredis');
const config = require('../config.json');
const redis = new Redis(config.redis);

const numClients = 256;
const globalEventStreamName = `${config.redisStreamPrefix}full`;

function pushData() {
  for (let i = 0; i < numClients; i++) {
    const channelId = String(i);
    const streamId = `${config.redisStreamPrefix}${channelId}`;
    const data = {
      channel_id: channelId,
      job_id: uuidv4(),
      status: 'pending',
    };

    // push to channel stream
    redis
      .xadd(streamId, 'MAXLEN', 1000, '*', 'data', JSON.stringify(data))
      .then(resp => {
        console.log('stream response', resp);
      });

    // push to firehose (all events) stream
    redis
      .xadd(
        globalEventStreamName,
        'MAXLEN',
        100000,
        '*',
        'data',
        JSON.stringify(data),
      )
      .then(resp => {
        console.log('stream response', resp);
      });
  }
}

pushData();
setInterval(pushData, 1000);
