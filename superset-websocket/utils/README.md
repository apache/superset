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
# Test & development utilities
The files provided here are for testing and development only, and are not required to run the WebSocket server application.

## Test client application
The Express web application in `client-ws-app` is provided for testing the WebSocket server. See `client-ws-app/README.md` for details.

## Load testing script
The `loadtest.js` script is provided to populate the Redis streams with event data.

### Running
```
node loadtest.js
```

The script will populate data continually until the script is exited using CTRL-C.

**Note:** `loadtest.js` and test client application are configured to use the server's local `config.json` values, so care should be taken to not overwrite any sensitive data.
