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
let socketCount = 0;
let messageCount = 0;
let lastMessage;

function ts() {
  return new Date().getTime();
}

const tokenData = document.getElementById('tokens').innerHTML;
const tokens = JSON.parse(tokenData);

function connect() {
  if (socketCount >= tokens.length) return;

  // Create WebSocket connection.
  let url = `ws://127.0.0.1:8080?last_id=${ts()}`;
  const socket = new WebSocket(url);

  // Connection opened
  socket.addEventListener('open', function () {
    // The first frame authenticates the socket with its ticket.
    socket.send(JSON.stringify({ type: 'auth', token: tokens[socketCount] }));
    socketCount++;
    document.getElementById('socket-count').innerHTML = socketCount;
    connect();
  });

  // Listen for messages
  socket.addEventListener('message', function (event) {
    messageCount++;
    lastMessage = event.data;
  });
}

connect();

setInterval(() => {
  document.getElementById('message-count').innerHTML = messageCount;
  document.getElementById('message-debug').innerHTML = lastMessage;
}, 250);
