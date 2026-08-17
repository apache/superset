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

const path = require('node:path');
const { concurrently } = require('concurrently');

const storybookPort = '6006';
const { result } = concurrently(
  [
    {
      name: 'SB',
      command: `python3 -m http.server ${storybookPort} --directory storybook-static`,
    },
    {
      name: 'TEST',
      command: `apt install -y netcat-openbsd && while ! nc -z 127.0.0.1 ${storybookPort}; do sleep 1; done && npm run test-storybook -- --maxWorkers=2`,
    },
  ],
  {
    killOthersOn: ['failure', 'success'],
    successCondition: 'first',
    prefixColors: ['magenta', 'blue'],
    cwd: path.resolve(__dirname, '..'),
  },
);

// Pass placeholder success/error handlers as CI runners should
// show errors clearly
result.then(
  () => {},
  () => {},
);
