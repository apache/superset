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
import type { TestRunnerConfig } from '@storybook/test-runner';

/**
 * Test runner configuration for Storybook smoke tests.
 *
 * The test-runner visits each story and verifies it renders without errors.
 * These are basic smoke tests - they don't test interactions or assertions,
 * just that stories can render successfully.
 */
const config: TestRunnerConfig = {
  async preVisit(page) {
    // Listen for page errors (JavaScript exceptions) and log them
    // This helps identify stories that crash during rendering
    page.on('pageerror', error => {
      console.error(`[page error] ${error.message}`);
    });
  },
};

export default config;
