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

/**
 * Jest configuration for @storybook/test-runner
 *
 * This extends the default test-runner config with custom timeouts
 * to handle slow story rendering in CI environments.
 */
const { getJestConfig } = require('@storybook/test-runner');
const testRunnerConfig = getJestConfig();

module.exports = {
  ...testRunnerConfig,
  // Increase timeout from default 15s to 60s for CI environments
  testTimeout: 60000,
};
