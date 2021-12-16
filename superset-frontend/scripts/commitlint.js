#!/usr/bin/env node

/*
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
 * Check commit messages only for the first commit in branch.
 */
const { execSync, spawnSync } = require('child_process');

const envVariable = process.argv[2] || 'GIT_PARAMS';

if (!envVariable || !process.env[envVariable]) {
  process.stdout.write(
    `Please provide a commit message via \`${envVariable}={Your Message}\`.\n`,
  );
  process.exit(0);
}
if (
  execSync('git rev-list --count HEAD ^master', {
    encoding: 'utf-8',
  }).trim() === '0'
) {
  const { status } = spawnSync(`commitlint`, ['-E', envVariable], {
    stdio: 'inherit',
  });
  process.exit(status);
}
