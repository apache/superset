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
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const config = require('../../../config.json');

router.get('/', function (req, res) {
  let numTokens = req.query.sockets ? Number(req.query.sockets) : 100;
  let tokens = [];
  for (let i = 0; i < numTokens; i++) {
    const token = jwt.sign({ channel: String(i) }, config.jwtSecret);
    tokens.push(token);
  }

  res.render('index', {
    tokens: JSON.stringify(tokens),
    c: config.jwtCookieName,
  });
});

module.exports = router;
