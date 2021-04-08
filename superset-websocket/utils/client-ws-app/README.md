<!--
Licensed to the Apache Software Foundation (ASF) under one
or more contributor license agreements.  See the NOTICE file
distributed with this work for additional information
regarding copyright ownership.  The ASF licenses this file
to you under the Apache License, Version 2.0 (the
"License"); you may not use this file except in compliance
with the License.  You may obtain a copy of the License at

  http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing,
software distributed under the License is distributed on an
"AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
KIND, either express or implied.  See the License for the
specific language governing permissions and limitations
under the License.
-->
# Test client application
This Express web application is provided for testing the WebSocket server. It is not required for running the server application, and is provided here for testing and development purposes only.

## Running
First, start the WebSocket server:
```
cd ..
npm run dev-server
```

Then run the client application:
```
cd client-ws-app
npm install
npm start
```

Open http://127.0.0.1:3000 in your web browser.

You can customize the number of WebSocket connections by passing the count in the `sockets` query param, e.g. `http://127.0.0.1:3000?sockets=180`, though beware that browsers limit the number of open WebSocket connections to around 200.

Run in conjunction with the `loadtest.js` script to populate the Redis streams with event data.

**Note:** this test application is configured to use the server's local `config.json` values, so care should be taken to not overwrite any sensitive data.
