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

// Source: https://gist.github.com/AriPerkkio/99b9eedc7d8f71ff6e6770f9425a4be4
import { defineConfig } from '@playwright/test';

const storybookUrl = process.env.STORYBOOK_URL ?? 'http://localhost:6006';
export default defineConfig({
  testDir: '.',
  globalSetup: 'setup-stories.ts',
  use: { baseURL: storybookUrl },
  fullyParallel: true,
  webServer: process.env.STORYBOOK_URL
    ? undefined
    : {
        command: 'npm run storybook -- --ci',
        url: `${storybookUrl}/index.json`,
        reuseExistingServer: true,
      },
});
