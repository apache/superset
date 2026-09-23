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
import express from 'express';
import jwt from 'jsonwebtoken';
import config from '../../../config.json' with { type: 'json' };

const router = express.Router();

router.get('/', function (req, res) {
  let numTokens = req.query.sockets ? Number(req.query.sockets) : 100;
  let tokens = [];
  for (let i = 0; i < numTokens; i++) {
    const subject = String(i);
    // These claims must match what the server verifies: the audience, issuer and
    // principal types are the REALTIME_JWT_AUDIENCE / REALTIME_JWT_ISSUER /
    // PRINCIPAL_TYPES constants in superset-websocket/src/index.ts, and the
    // channel is derived the same way as `principalChannel` there.
    const token = jwt.sign(
      {
        aud: 'superset-websocket',
        channel: `user:${subject}`,
        exp: Math.floor(Date.now() / 1000) + 3600,
        iss: 'superset',
        principal_type: 'user',
        sub: subject,
      },
      config.jwtSecret,
    );
    tokens.push(token);
  }

  res.render('index', {
    tokens: JSON.stringify(tokens),
    c: config.jwtCookieName,
  });
});

export default router;
